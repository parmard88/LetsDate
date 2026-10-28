import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { requireSession } from "../middleware/requireSession.js";

const router = Router();

router.use(requireSession);

const preferredGenderOptions = [
  "male",
  "female",
  "non-binary",
  "everyone",
] as const;

const relationshipGoalOptions = [
  "long-term",
  "short-term",
  "friendship",
  "unsure",
] as const;

const profilePatchSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80).optional(),

    bio: z.string().trim().max(500).nullable().optional(),

    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format.")
      .optional(),

    gender: z.string().trim().min(1).max(40).nullable().optional(),

    city: z.string().trim().min(1).max(100).nullable().optional(),

    country: z.string().trim().min(1).max(100).nullable().optional(),

    preferredGender: z
      .enum(preferredGenderOptions)
      .nullable()
      .optional(),

    minPreferredAge: z
      .number()
      .int()
      .min(18)
      .max(100)
      .nullable()
      .optional(),

    maxPreferredAge: z
      .number()
      .int()
      .min(18)
      .max(100)
      .nullable()
      .optional(),

    relationshipGoal: z
      .enum(relationshipGoalOptions)
      .nullable()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one profile field to update.",
  });

function parseDateOfBirth(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();

  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();

  const monthDifference = today.getUTCMonth() - dateOfBirth.getUTCMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getUTCDate() < dateOfBirth.getUTCDate())
  ) {
    age -= 1;
  }

  return age;
}

function calculateProfileCompletion(profile: {
  displayName: string;
  bio: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  preferredGender: string | null;
  minPreferredAge: number | null;
  maxPreferredAge: number | null;
  relationshipGoal: string | null;
}) {
  const checks = [
    Boolean(profile.displayName.trim()),
    Boolean(profile.bio?.trim()),
    profile.dateOfBirth !== null,
    Boolean(profile.gender?.trim()),
    Boolean(profile.city?.trim()),
    Boolean(profile.country?.trim()),
    Boolean(profile.preferredGender),
    profile.minPreferredAge !== null &&
      profile.maxPreferredAge !== null,
    Boolean(profile.relationshipGoal),
  ];

  const totalFields = checks.length;
  const completedFields = checks.filter(Boolean).length;

  return {
    percentage: Math.round((completedFields / totalFields) * 100),
    completedFields,
    totalFields,
  };
}

function formatProfile(
  user: {
    id: string;
    email: string;
    displayName: string;
    createdAt: Date;
  },
  profile: {
    bio: string | null;
    dateOfBirth: Date | null;
    gender: string | null;
    city: string | null;
    country: string | null;
    preferredGender: string | null;
    minPreferredAge: number | null;
    maxPreferredAge: number | null;
    relationshipGoal: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
) {
  const profileData = {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    bio: profile.bio,
    dateOfBirth: profile.dateOfBirth
      ? profile.dateOfBirth.toISOString().slice(0, 10)
      : null,
    gender: profile.gender,
    city: profile.city,
    country: profile.country,
    preferredGender: profile.preferredGender,
    minPreferredAge: profile.minPreferredAge,
    maxPreferredAge: profile.maxPreferredAge,
    relationshipGoal: profile.relationshipGoal,
    accountCreatedAt: user.createdAt,
    profileCreatedAt: profile.createdAt,
    profileUpdatedAt: profile.updatedAt,
  };

  return {
    ...profileData,
    profileCompletion: calculateProfileCompletion({
      displayName: user.displayName,
      bio: profile.bio,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
      city: profile.city,
      country: profile.country,
      preferredGender: profile.preferredGender,
      minPreferredAge: profile.minPreferredAge,
      maxPreferredAge: profile.maxPreferredAge,
      relationshipGoal: profile.relationshipGoal,
    }),
  };
}

// GET /api/profile
router.get("/", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        profile: {
          select: {
            bio: true,
            dateOfBirth: true,
            gender: true,
            city: true,
            country: true,
            preferredGender: true,
            minPreferredAge: true,
            maxPreferredAge: true,
            relationshipGoal: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "The account associated with this session no longer exists.",
      });
      return;
    }

    // A new account may not have a profile row yet.
    const profile = user.profile ?? {
      bio: null,
      dateOfBirth: null,
      gender: null,
      city: null,
      country: null,
      preferredGender: null,
      minPreferredAge: null,
      maxPreferredAge: null,
      relationshipGoal: null,
      createdAt: null,
      updatedAt: null,
    };

    const profileCompletion = calculateProfileCompletion({
      displayName: user.displayName,
      bio: profile.bio,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
      city: profile.city,
      country: profile.country,
      preferredGender: profile.preferredGender,
      minPreferredAge: profile.minPreferredAge,
      maxPreferredAge: profile.maxPreferredAge,
      relationshipGoal: profile.relationshipGoal,
    });

    res.status(200).json({
      success: true,
      profile: {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        bio: profile.bio,
        dateOfBirth: profile.dateOfBirth
          ? profile.dateOfBirth.toISOString().slice(0, 10)
          : null,
        gender: profile.gender,
        city: profile.city,
        country: profile.country,
        preferredGender: profile.preferredGender,
        minPreferredAge: profile.minPreferredAge,
        maxPreferredAge: profile.maxPreferredAge,
        relationshipGoal: profile.relationshipGoal,
        accountCreatedAt: user.createdAt,
        profileCreatedAt: profile.createdAt,
        profileUpdatedAt: profile.updatedAt,
        profileCompletion,
      },
    });
  } catch (error: unknown) {
    console.error("Profile retrieval failed.");

    res.status(500).json({
      success: false,
      message: "Unable to retrieve your profile right now.",
    });
  }
});

// PATCH /api/profile
router.patch("/", async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;

  // Protect browser requests against unexpected cross-origin writes.
  const origin = req.get("origin");
  const frontendUrl = process.env.FRONTEND_URL;

  if (origin && frontendUrl) {
    try {
      if (new URL(origin).origin !== new URL(frontendUrl).origin) {
        res.status(403).json({
          success: false,
          message: "This request origin is not allowed.",
        });
        return;
      }
    } catch {
      res.status(403).json({
        success: false,
        message: "This request origin is not allowed.",
      });
      return;
    }
  }

  const validation = profilePatchSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({
      success: false,
      message: "Please check the profile details.",
      errors: validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  const data = validation.data;

  let parsedDateOfBirth: Date | undefined;

  if (data.dateOfBirth !== undefined) {
    parsedDateOfBirth = parseDateOfBirth(data.dateOfBirth) ?? undefined;

    if (!parsedDateOfBirth) {
      res.status(400).json({
        success: false,
        message: "Enter a valid date of birth in YYYY-MM-DD format.",
      });
      return;
    }

    if (calculateAge(parsedDateOfBirth) < 18) {
      res.status(400).json({
        success: false,
        message: "You must be at least 18 years old to use LetsDate.",
      });
      return;
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingProfile = await tx.userProfile.findUnique({
        where: { userId },
        select: {
          minPreferredAge: true,
          maxPreferredAge: true,
        },
      });

      // Validate the final age range, including values already saved.
      const finalMinAge =
        data.minPreferredAge !== undefined
          ? data.minPreferredAge
          : existingProfile?.minPreferredAge ?? null;

      const finalMaxAge =
        data.maxPreferredAge !== undefined
          ? data.maxPreferredAge
          : existingProfile?.maxPreferredAge ?? null;

      if (
        finalMinAge !== null &&
        finalMaxAge !== null &&
        finalMinAge > finalMaxAge
      ) {
        throw new Error("INVALID_PREFERRED_AGE_RANGE");
      }

      if (data.displayName !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { displayName: data.displayName },
        });
      }

      const profileUpdate: {
        bio?: string | null;
        dateOfBirth?: Date;
        gender?: string | null;
        city?: string | null;
        country?: string | null;
        preferredGender?: string | null;
        minPreferredAge?: number | null;
        maxPreferredAge?: number | null;
        relationshipGoal?: string | null;
      } = {};

      if (data.bio !== undefined) profileUpdate.bio = data.bio;

      if (parsedDateOfBirth !== undefined) {
        profileUpdate.dateOfBirth = parsedDateOfBirth;
      }

      if (data.gender !== undefined) profileUpdate.gender = data.gender;
      if (data.city !== undefined) profileUpdate.city = data.city;
      if (data.country !== undefined) profileUpdate.country = data.country;

      if (data.preferredGender !== undefined) {
        profileUpdate.preferredGender = data.preferredGender;
      }

      if (data.minPreferredAge !== undefined) {
        profileUpdate.minPreferredAge = data.minPreferredAge;
      }

      if (data.maxPreferredAge !== undefined) {
        profileUpdate.maxPreferredAge = data.maxPreferredAge;
      }

      if (data.relationshipGoal !== undefined) {
        profileUpdate.relationshipGoal = data.relationshipGoal;
      }

      const profile = await tx.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          bio: data.bio ?? null,
          dateOfBirth: parsedDateOfBirth ?? null,
          gender: data.gender ?? null,
          city: data.city ?? null,
          country: data.country ?? null,
          preferredGender: data.preferredGender ?? null,
          minPreferredAge: data.minPreferredAge ?? null,
          maxPreferredAge: data.maxPreferredAge ?? null,
          relationshipGoal: data.relationshipGoal ?? null,
        },
        update: profileUpdate,
        select: {
          bio: true,
          dateOfBirth: true,
          gender: true,
          city: true,
          country: true,
          preferredGender: true,
          minPreferredAge: true,
          maxPreferredAge: true,
          relationshipGoal: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          displayName: true,
          createdAt: true,
        },
      });

      return { user, profile };
    });

    if (!result.user) {
      res.status(401).json({
        success: false,
        message: "The account associated with this session no longer exists.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      profile: formatProfile(result.user, result.profile),
    });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "INVALID_PREFERRED_AGE_RANGE"
    ) {
      res.status(400).json({
        success: false,
        message:
          "Minimum preferred age cannot be greater than maximum preferred age.",
      });
      return;
    }

    console.error("Profile update failed.");

    res.status(500).json({
      success: false,
      message: "Unable to update your profile right now.",
    });
  }
});

export default router;