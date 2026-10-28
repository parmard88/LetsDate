import "dotenv/config";

import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { sendVerificationEmail } from "../services/emailService.js";

const router = Router();

const SESSION_COOKIE = "letsdate_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function isEmailVerificationRequired(): boolean {
  return process.env.EMAIL_VERIFICATION_REQUIRED !== "false";
}

if (process.env.NODE_ENV === "production" && !isEmailVerificationRequired()) {
  throw new Error("Email verification cannot be disabled in production.");
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many registration attempts. Please try again later.",
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
});

const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification attempts. Please try again later.",
  },
});

const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many resend attempts. Please try again later.",
  },
});

const registrationSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters.")
      .max(80, "Name must not exceed 80 characters."),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address.")
      .max(254, "Email address is too long."),
    password: z
      .string()
      .min(12, "Password must contain at least 12 characters.")
      .max(128, "Password must not exceed 128 characters."),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
  })
  .strict();

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

async function issueVerificationEmail(user: {
  id: string;
  email: string;
  displayName: string;
}): Promise<void> {
  const token = createVerificationToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.verificationToken.upsert({
    where: { userId: user.id },
    create: { userId: user.id, tokenHash, expiresAt },
    update: { tokenHash, expiresAt, createdAt: new Date() },
  });

  try {
    await sendVerificationEmail({
      email: user.email,
      displayName: user.displayName,
      token,
    });
  } catch (error: unknown) {
    await prisma.verificationToken.deleteMany({
      where: { userId: user.id, tokenHash },
    });

    throw error;
  }
}

// REGISTER
router.post(
  "/register",
  registrationLimiter,
  async (req, res): Promise<void> => {
    const validation = registrationSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Please check the submitted details.",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const { displayName, email, password } = validation.data;
    const verificationRequired = isEmailVerificationRequired();

    try {
      const passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
      });

      const user = await prisma.user.create({
        data: {
          displayName,
          email,
          passwordHash,
          emailVerified: !verificationRequired,
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          emailVerified: true,
          createdAt: true,
        },
      });

      if (verificationRequired) {
        try {
          await issueVerificationEmail(user);
        } catch {
          console.error("Verification email delivery failed.");

          res.status(503).json({
            success: false,
            message:
              "Your account was created, but the verification email could not be sent. Please try the resend verification endpoint.",
          });
          return;
        }
      }

      res.status(201).json({
        success: true,
        message: verificationRequired
          ? "Account created. Check your email to verify your address."
          : "Account created successfully.",
        user,
      });
    } catch (error: unknown) {
      if (isUniqueConstraintError(error)) {
        res.status(409).json({
          success: false,
          message: "Unable to create an account with those details.",
        });
        return;
      }

      console.error("Registration failed.");

      res.status(500).json({
        success: false,
        message: "Unable to process registration right now.",
      });
    }
  }
);

// LOGIN
router.post("/login", loginLimiter, async (req, res): Promise<void> => {
  const validation = loginSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({
      success: false,
      message: "Enter a valid email address and password.",
    });
    return;
  }

  const { email, password } = validation.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        displayName: true,
        email: true,
        passwordHash: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    const passwordMatches = await argon2.verify(user.passwordHash, password);

    if (!passwordMatches) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    if (isEmailVerificationRequired() && !user.emailVerified) {
      res.status(403).json({
        success: false,
        message: "Please verify your email before signing in.",
      });
      return;
    }

    const rawSessionToken = randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await prisma.session.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    res.cookie(SESSION_COOKIE, rawSessionToken, {
      ...cookieOptions(),
      maxAge: SESSION_DURATION_MS,
    });

    res.status(200).json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });
  } catch {
    console.error("Login failed due to a server or database error.");

    res.status(500).json({
      success: false,
      message: "Unable to process login right now.",
    });
  }
});

// CHECK CURRENT SESSION
router.get("/me", async (req, res): Promise<void> => {
  const rawToken = req.cookies?.[SESSION_COOKIE];

  if (typeof rawToken !== "string" || !/^[a-f0-9]{64}$/.test(rawToken)) {
    res.status(401).json({
      success: false,
      message: "You are not signed in.",
    });
    return;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      select: {
        id: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
            emailVerified: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await prisma.session.deleteMany({
          where: { id: session.id },
        });
      }

      res.clearCookie(SESSION_COOKIE, cookieOptions());
      res.status(401).json({
        success: false,
        message: "Your session is invalid or expired. Please sign in again.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: session.user,
    });
  } catch {
    console.error("Session lookup failed.");

    res.status(500).json({
      success: false,
      message: "Unable to check your session right now.",
    });
  }
});

// LOGOUT
router.post("/logout", async (req, res): Promise<void> => {
  const rawToken = req.cookies?.[SESSION_COOKIE];

  try {
    if (typeof rawToken === "string" && /^[a-f0-9]{64}$/.test(rawToken)) {
      await prisma.session.deleteMany({
        where: { tokenHash: hashToken(rawToken) },
      });
    }

    res.clearCookie(SESSION_COOKIE, cookieOptions());
    res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch {
    console.error("Logout failed.");

    res.status(500).json({
      success: false,
      message: "Unable to log out right now.",
    });
  }
});

// VERIFY EMAIL
router.get(
  "/verify-email",
  verificationLimiter,
  async (req, res): Promise<void> => {
    const token = req.query.token;

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      res.status(400).json({
        success: false,
        message: "The verification link is invalid or expired.",
      });
      return;
    }

    const tokenHash = hashToken(token);

    try {
      const verification = await prisma.verificationToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, expiresAt: true },
      });

      if (!verification || verification.expiresAt <= new Date()) {
        if (verification) {
          await prisma.verificationToken.deleteMany({
            where: { id: verification.id },
          });
        }

        res.status(400).json({
          success: false,
          message: "The verification link is invalid or expired.",
        });
        return;
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id: verification.userId },
          data: { emailVerified: true },
        }),
        prisma.verificationToken.delete({
          where: { id: verification.id },
        }),
      ]);

      res.status(200).json({
        success: true,
        message: "Email verified successfully.",
      });
    } catch {
      console.error("Email verification failed.");

      res.status(500).json({
        success: false,
        message: "Unable to verify this email right now.",
      });
    }
  }
);

// RESEND VERIFICATION
router.post(
  "/resend-verification",
  resendLimiter,
  async (req, res): Promise<void> => {
    if (!isEmailVerificationRequired()) {
      res.status(200).json({
        success: true,
        message: "Email verification is disabled in this environment.",
      });
      return;
    }

    const validation = emailSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { email: validation.data.email },
        select: {
          id: true,
          email: true,
          displayName: true,
          emailVerified: true,
        },
      });

      if (user && !user.emailVerified) {
        try {
          await issueVerificationEmail(user);
        } catch {
          console.error("Verification email resend failed.");

          res.status(503).json({
            success: false,
            message: "Unable to send a verification email right now.",
          });
          return;
        }
      }

      res.status(200).json({
        success: true,
        message:
          "If an unverified account exists for that address, a verification email will be sent.",
      });
    } catch {
      console.error("Verification resend request failed.");

      res.status(500).json({
        success: false,
        message: "Unable to process the request right now.",
      });
    }
  }
);

export default router;
