import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { requireSession } from "../middleware/requireSession.js";
import { getPhotoUrl } from "../services/photoStorageService.js";

const router = Router();

router.use(requireSession);

const disclosedGenders = ["male", "female", "non-binary", "other"] as const;

const targetIdSchema = z.string().min(1).max(30);

type MatchingProfile = {
  dateOfBirth: Date | null;
  gender: string | null;
  preferredGender: string | null;
  minPreferredAge: number | null;
  maxPreferredAge: number | null;
};

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();

  let age = today.getUTCFullYear() - dateOfBirth.getUTCFullYear();

  const monthDifference = today.getUTCMonth() - dateOfBirth.getUTCMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getUTCDate() < dateOfBirth.getUTCDate())
  ) {
    age -= 1;
  }

  return age;
}

function isDisclosedGender(value: string | null): boolean {
  return (
    value !== null &&
    disclosedGenders.includes(
      value.trim().toLowerCase() as (typeof disclosedGenders)[number]
    )
  );
}

function acceptsGender(preference: string, gender: string): boolean {
  const normalizedPreference = preference.trim().toLowerCase();

  return (
    normalizedPreference === "everyone" ||
    normalizedPreference === gender.trim().toLowerCase()
  );
}

function isMutuallyCompatible(
  viewer: MatchingProfile,
  candidate: MatchingProfile
): boolean {
  if (
    !viewer.dateOfBirth ||
    !candidate.dateOfBirth ||
    !isDisclosedGender(viewer.gender) ||
    !isDisclosedGender(candidate.gender) ||
    !viewer.preferredGender ||
    !candidate.preferredGender ||
    viewer.minPreferredAge === null ||
    viewer.maxPreferredAge === null ||
    candidate.minPreferredAge === null ||
    candidate.maxPreferredAge === null
  ) {
    return false;
  }

  const viewerAge = calculateAge(viewer.dateOfBirth);
  const candidateAge = calculateAge(candidate.dateOfBirth);

  if (
    viewerAge < 18 ||
    candidateAge < 18 ||
    viewer.minPreferredAge > viewer.maxPreferredAge ||
    candidate.minPreferredAge > candidate.maxPreferredAge
  ) {
    return false;
  }

  const candidateMeetsViewerAge =
    candidateAge >= viewer.minPreferredAge &&
    candidateAge <= viewer.maxPreferredAge;

  const candidateMeetsViewerGender = acceptsGender(
    viewer.preferredGender,
    candidate.gender!
  );

  const viewerMeetsCandidateAge =
    viewerAge >= candidate.minPreferredAge &&
    viewerAge <= candidate.maxPreferredAge;

  const viewerMeetsCandidateGender = acceptsGender(
    candidate.preferredGender,
    viewer.gender!
  );

  return (
    candidateMeetsViewerAge &&
    candidateMeetsViewerGender &&
    viewerMeetsCandidateAge &&
    viewerMeetsCandidateGender
  );
}

async function isBlocked(userOneId: string, userTwoId: string) {
  return prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userOneId, blockedUserId: userTwoId },
        { blockerId: userTwoId, blockedUserId: userOneId },
      ],
    },
    select: { id: true },
  });
}

// POST /api/discovery/:targetUserId/like
// POST /api/discovery/:targetUserId/pass
async function handleSwipe(
  req: Request<{ targetUserId: string }>,
  res: Response,
  action: "LIKE" | "PASS"
): Promise<void> {
  const userId = res.locals.userId as string;

  const validation = targetIdSchema.safeParse(req.params.targetUserId);

  if (!validation.success) {
    res.status(400).json({
      success: false,
      message: "Invalid profile ID.",
    });
    return;
  }

  const targetUserId = validation.data;

  if (targetUserId === userId) {
    res.status(400).json({
      success: false,
      message: "You cannot like or pass your own profile.",
    });
    return;
  }

  try {
    const [viewer, target] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          profile: {
            select: {
              dateOfBirth: true,
              gender: true,
              preferredGender: true,
              minPreferredAge: true,
              maxPreferredAge: true,
            },
          },
        },
      }),

      prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          emailVerified: true,
          profile: {
            select: {
              dateOfBirth: true,
              gender: true,
              preferredGender: true,
              minPreferredAge: true,
              maxPreferredAge: true,
            },
          },
          photos: {
            where: { isPrimary: true },
            take: 1,
            select: { id: true },
          },
        },
      }),
    ]);

    if (!viewer || !viewer.profile) {
      res.status(400).json({
        success: false,
        message: "Complete your profile and matching preferences first.",
      });
      return;
    }

    if (
      !target ||
      !target.emailVerified ||
      !target.profile ||
      target.photos.length === 0 ||
      !isMutuallyCompatible(viewer.profile, target.profile)
    ) {
      res.status(404).json({
        success: false,
        message: "This profile is no longer available for discovery.",
      });
      return;
    }

    const blocked = await isBlocked(userId, targetUserId);

    if (blocked) {
      res.status(404).json({
        success: false,
        message: "This profile is no longer available.",
      });
      return;
    }

    const existingSwipe = await prisma.swipe.findUnique({
      where: {
        swiperId_targetUserId: {
          swiperId: userId,
          targetUserId,
        },
      },
      select: { id: true },
    });

    if (existingSwipe) {
      res.status(409).json({
        success: false,
        message: "You have already responded to this profile.",
      });
      return;
    }

    const existingMatch = await prisma.match.findFirst({
      where: {
        OR: [
          { userOneId: userId, userTwoId: targetUserId },
          { userOneId: targetUserId, userTwoId: userId },
        ],
      },
      select: { id: true },
    });

    if (existingMatch) {
      res.status(409).json({
        success: false,
        message: "You are already matched with this person.",
      });
      return;
    }

    let matched = false;
    let matchId: string | null = null;

    await prisma.$transaction(async (transaction) => {
      await transaction.swipe.create({
        data: {
          swiperId: userId,
          targetUserId,
          action,
        },
      });

      if (action !== "LIKE") {
        return;
      }

      const reciprocalLike = await transaction.swipe.findUnique({
        where: {
          swiperId_targetUserId: {
            swiperId: targetUserId,
            targetUserId: userId,
          },
        },
        select: {
          id: true,
          action: true,
        },
      });

      if (!reciprocalLike || reciprocalLike.action !== "LIKE") {
        return;
      }

      const userOneId = userId < targetUserId ? userId : targetUserId;

      const userTwoId = userId < targetUserId ? targetUserId : userId;

      const match = await transaction.match.create({
        data: {
          userOneId,
          userTwoId,
        },
        select: { id: true },
      });

      matched = true;
      matchId = match.id;
    });

    res.status(200).json({
      success: true,
      action: action.toLowerCase(),
      matched,
      matchId,
      message:
        action === "PASS"
          ? "Profile passed."
          : matched
          ? "It's a match! You both liked each other."
          : "Like saved.",
    });
  } catch (error: unknown) {
    // Handle duplicate swipes or a simultaneous mutual-match creation.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      const existingSwipe = await prisma.swipe.findUnique({
        where: {
          swiperId_targetUserId: {
            swiperId: userId,
            targetUserId,
          },
        },
        select: { id: true },
      });

      if (existingSwipe) {
        res.status(409).json({
          success: false,
          message: "You have already responded to this profile.",
        });
        return;
      }

      const userOneId = userId < targetUserId ? userId : targetUserId;

      const userTwoId = userId < targetUserId ? targetUserId : userId;

      const existingMatch = await prisma.match.findUnique({
        where: {
          userOneId_userTwoId: {
            userOneId,
            userTwoId,
          },
        },
        select: { id: true },
      });

      if (existingMatch) {
        res.status(200).json({
          success: true,
          action: action.toLowerCase(),
          matched: true,
          matchId: existingMatch.id,
          message: "It's a match! You both liked each other.",
        });
        return;
      }
    }

    console.error("Matching action failed.");

    res.status(500).json({
      success: false,
      message: "Unable to process your response right now.",
    });
  }
}

router.post("/:targetUserId/like", async (req, res): Promise<void> => {
  await handleSwipe(req, res, "LIKE");
});

router.post("/:targetUserId/pass", async (req, res): Promise<void> => {
  await handleSwipe(req, res, "PASS");
});

// GET /api/matches
router.get("/", async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;

  try {
    const [matches, blocks] = await Promise.all([
      prisma.match.findMany({
        where: {
          OR: [{ userOneId: userId }, { userTwoId: userId }],
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userOneId: true,
          userTwoId: true,
          createdAt: true,
          userOne: {
            select: {
              id: true,
              displayName: true,
              profile: {
                select: {
                  dateOfBirth: true,
                  gender: true,
                  city: true,
                  country: true,
                  relationshipGoal: true,
                },
              },
              photos: {
                where: { isPrimary: true },
                take: 1,
                select: {
                  storageKey: true,
                  contentType: true,
                },
              },
            },
          },
          userTwo: {
            select: {
              id: true,
              displayName: true,
              profile: {
                select: {
                  dateOfBirth: true,
                  gender: true,
                  city: true,
                  country: true,
                  relationshipGoal: true,
                },
              },
              photos: {
                where: { isPrimary: true },
                take: 1,
                select: {
                  storageKey: true,
                  contentType: true,
                },
              },
            },
          },
        },
      }),

      prisma.block.findMany({
        where: {
          OR: [{ blockerId: userId }, { blockedUserId: userId }],
        },
        select: {
          blockerId: true,
          blockedUserId: true,
        },
      }),
    ]);

    const blockedUserIds = new Set(
      blocks.map((block) =>
        block.blockerId === userId ? block.blockedUserId : block.blockerId
      )
    );

    const visibleMatches = matches.filter((match) => {
      const otherUserId =
        match.userOneId === userId ? match.userTwoId : match.userOneId;

      return !blockedUserIds.has(otherUserId);
    });

    const results = await Promise.all(
      visibleMatches.map(async (match) => {
        const otherUser =
          match.userOneId === userId ? match.userTwo : match.userOne;

        const profile = otherUser.profile;
        const photo = otherUser.photos[0];

        const photoUrl = photo ? await getPhotoUrl(photo.storageKey) : null;

        return {
          matchId: match.id,
          matchedAt: match.createdAt,
          user: {
            id: otherUser.id,
            displayName: otherUser.displayName,
            age: profile?.dateOfBirth
              ? calculateAge(profile.dateOfBirth)
              : null,
            gender: profile?.gender ?? null,
            city: profile?.city ?? null,
            country: profile?.country ?? null,
            relationshipGoal: profile?.relationshipGoal ?? null,
            primaryPhoto: photo
              ? {
                  url: photoUrl,
                  contentType: photo.contentType,
                }
              : null,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      count: results.length,
      matches: results,
    });
  } catch (error: unknown) {
    console.error("Match retrieval failed.");

    res.status(500).json({
      success: false,
      message: "Unable to load your matches right now.",
    });
  }
});

export default router;
