
import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { prisma } from "../config/database.js";

const SESSION_COOKIE = "letsdate_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const requireSession: RequestHandler = async (
  req,
  res,
  next,
): Promise<void> => {
  const rawToken = req.cookies?.[SESSION_COOKIE];

  if (
    typeof rawToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(rawToken)
  ) {
    res.status(401).json({
      success: false,
      message: "Please sign in to continue.",
    });
    return;
  }

  try {
    const session = await prisma.session.findUnique({
      where: {
        tokenHash: hashToken(rawToken),
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
      },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await prisma.session.deleteMany({
          where: { id: session.id },
        });
      }

      res.clearCookie(SESSION_COOKIE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      res.status(401).json({
        success: false,
        message: "Your session is invalid or expired. Please sign in again.",
      });
      return;
    }

    res.locals.userId = session.userId;
    next();
  } catch (error: unknown) {
    next(error);
  }
};
