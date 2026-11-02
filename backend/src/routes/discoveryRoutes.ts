import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { requireSession } from "../middleware/requireSession.js";
import { getPhotoUrl } from "../services/photoStorageService.js";

const router = Router();

router.use(requireSession);

const disclosedGenders = ["male", "female", "non-binary", "other"] as const;

const discoveryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});

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

function acceptsGender(preference: string | null, gender: string): boolean {
  if (!preference) {
    return false;
  }

  const normalizedPreference = preference.trim().toLowerCase();

  return (
    normalizedPreference === "everyone" ||
    normalizedPreference === gender.trim().toLowerCase()
  );
}

// GET /api/discovery
router.get("/", async (req, res): Promise<void> => {
  const userId = res.locals.userId as string;

  const queryValidation = discoveryQuerySchema.safeParse(req.query);

  if (!queryValidation.success) {
    res.status(400).json({
      success: false,
      message: "Invalid discovery pagination values.",
    });
    return;
  }

  const { limit, offset } = queryValidation.data;

  try {
    const viewer = await prisma.user.findUnique({
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
    });

    if (!viewer) {
      res.status(401).json({
        success: false,
        message: "Your account could not be found.",
      });
      return;
    }

    const viewerProfile = viewer.profile;

    // Discovery requires the viewer to have completed their
    // basic age and gender matching preferences.
    if (
      !viewerProfile ||
      !viewerProfile.dateOfBirth ||
      !isDisclosedGender(viewerProfile.gender) ||
      !viewerProfile.preferredGender ||
      viewerProfile.minPreferredAge === null ||
      viewerProfile.maxPreferredAge === null
    ) {
      res.status(200).json({
        success: true,
        message:
          "Complete your date of birth, gender, and matching preferences to discover profiles.",
        profiles: [],
        pagination: {
          limit,
          offset,
          hasMore: false,
          nextOffset: null,
        },
      });
      return;
    }

    const viewerAge = calculateAge(viewerProfile.dateOfBirth);
    const viewerGender = viewerProfile.gender!.trim().toLowerCase();

    if (
      viewerAge < 18 ||
      viewerProfile.minPreferredAge > viewerProfile.maxPreferredAge
    ) {
      res.status(200).json({
        success: true,
        message: "Your matching preferences need to be updated.",
        profiles: [],
        pagination: {
          limit,
          offset,
          hasMore: false,
          nextOffset: null,
        },
      });
      return;
    }

    // Find people who must be excluded from discovery.
    const [swipes, blocks, matches] = await Promise.all([
      prisma.swipe.findMany({
        where: { swiperId: userId },
        select: { targetUserId: true },
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

      prisma.match.findMany({
        where: {
          OR: [{ userOneId: userId }, { userTwoId: userId }],
        },
        select: {
          userOneId: true,
          userTwoId: true,
        },
      }),
    ]);

    const excludedUserIds = new Set<string>();

    for (const swipe of swipes) {
      excludedUserIds.add(swipe.targetUserId);
    }

    for (const block of blocks) {
      excludedUserIds.add(
        block.blockerId === userId ? block.blockedUserId : block.blockerId
      );
    }

    for (const match of matches) {
      excludedUserIds.add(
        match.userOneId === userId ? match.userTwoId : match.userOneId
      );
    }

    // Only fetch accounts that have a primary photo.
    const candidates = await prisma.user.findMany({
      where: {
        id: {
          not: userId,
          notIn: Array.from(excludedUserIds),
        },
        emailVerified: true,
        photos: {
          some: {
            isPrimary: true,
          },
        },
      },
      select: {
        id: true,
        displayName: true,
        profile: {
          select: {
            bio: true,
            dateOfBirth: true,
            gender: true,
            preferredGender: true,
            minPreferredAge: true,
            maxPreferredAge: true,
            city: true,
            country: true,
            relationshipGoal: true,
          },
        },
        photos: {
          where: {
            isPrimary: true,
          },
          take: 1,
          select: {
            storageKey: true,
            contentType: true,
            sizeBytes: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Apply reciprocal age and gender compatibility.
    const compatibleCandidates = candidates.filter((candidate) => {
      const profile = candidate.profile;

      if (
        !profile ||
        !profile.dateOfBirth ||
        !isDisclosedGender(profile.gender) ||
        !profile.preferredGender ||
        profile.minPreferredAge === null ||
        profile.maxPreferredAge === null
      ) {
        return false;
      }

      const candidateGender = profile.gender!.trim().toLowerCase();
      const candidateAge = calculateAge(profile.dateOfBirth);

      if (candidateAge < 18) {
        return false;
      }

      if (profile.minPreferredAge > profile.maxPreferredAge) {
        return false;
      }

      // Candidate must meet the viewer's preferences.
      const candidateMeetsViewerAgePreference =
        candidateAge >= viewerProfile.minPreferredAge! &&
        candidateAge <= viewerProfile.maxPreferredAge!;

      const candidateMeetsViewerGenderPreference = acceptsGender(
        viewerProfile.preferredGender,
        candidateGender
      );

      // Viewer must meet the candidate's preferences.
      const viewerMeetsCandidateAgePreference =
        viewerAge >= profile.minPreferredAge &&
        viewerAge <= profile.maxPreferredAge;

      const viewerMeetsCandidateGenderPreference = acceptsGender(
        profile.preferredGender,
        viewerGender
      );

      return (
        candidateMeetsViewerAgePreference &&
        candidateMeetsViewerGenderPreference &&
        viewerMeetsCandidateAgePreference &&
        viewerMeetsCandidateGenderPreference
      );
    });

    const page = compatibleCandidates.slice(offset, offset + limit);

    const profiles = await Promise.all(
      page.map(async (candidate) => {
        const profile = candidate.profile!;
        const photo = candidate.photos[0]!;

        const age = calculateAge(profile.dateOfBirth!);
        const photoUrl = await getPhotoUrl(photo.storageKey);

        return {
          id: candidate.id,
          displayName: candidate.displayName,
          age,
          bio: profile.bio,
          gender: profile.gender,
          city: profile.city,
          country: profile.country,
          relationshipGoal: profile.relationshipGoal,
          primaryPhoto: {
            url: photoUrl,
            contentType: photo.contentType,
            sizeBytes: photo.sizeBytes,
          },
        };
      })
    );

    const hasMore = compatibleCandidates.length > offset + profiles.length;

    res.status(200).json({
      success: true,
      profiles,
      pagination: {
        limit,
        offset,
        hasMore,
        nextOffset: hasMore ? offset + profiles.length : null,
      },
    });
  } catch (error: unknown) {
    console.error("Discovery retrieval failed.");

    res.status(500).json({
      success: false,
      message: "Unable to load discovery profiles right now.",
    });
  }
});

export default router;
