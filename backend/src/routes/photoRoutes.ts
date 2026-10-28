import { randomUUID } from "node:crypto";
import { Router, type RequestHandler } from "express";
import multer from "multer";
import sharp from "sharp";

import { prisma } from "../config/database.js";
import { requireSession } from "../middleware/requireSession.js";
import {
  getPhotoUrl,
  removeStoredPhoto,
  storePhoto,
} from "../services/photoStorageService.js";

const router = Router();

const MAX_PHOTOS = 6;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    fields: 0,
  },
});

const receivePhoto: RequestHandler = (req, res, next) => {
  upload.single("photo")(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";

      res.status(tooLarge ? 413 : 400).json({
        success: false,
        message: tooLarge
          ? "Photo must be 5 MB or smaller."
          : "Invalid photo upload. Send one file using the field name 'photo'.",
      });
      return;
    }

    if (error) {
      next(error);
      return;
    }

    next();
  });
};

router.use(requireSession);

router.get("/", async (_req, res, next) => {
  try {
    const userId = res.locals.userId as string;

    const photos = await prisma.userPhoto.findMany({
      where: { userId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    const result = await Promise.all(
      photos.map(async (photo) => ({
        id: photo.id,
        url: await getPhotoUrl(photo.storageKey),
        contentType: photo.contentType,
        sizeBytes: photo.sizeBytes,
        isPrimary: photo.isPrimary,
        position: photo.position,
        createdAt: photo.createdAt,
      }))
    );

    res.json({ success: true, photos: result });
  } catch (error) {
    next(error);
  }
});

router.post("/", receivePhoto, async (req, res, next) => {
  let storageKey: string | undefined;

  try {
    const userId = res.locals.userId as string;
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        message: "Choose an image file using the 'photo' field.",
      });
      return;
    }

    const existingCount = await prisma.userPhoto.count({
      where: { userId },
    });

    if (existingCount >= MAX_PHOTOS) {
      res.status(409).json({
        success: false,
        message: `You can upload a maximum of ${MAX_PHOTOS} profile photos.`,
      });
      return;
    }

    // Inspect the image's actual content rather than trusting its filename
    // or the Content-Type supplied by the client.
    const metadata = await sharp(file.buffer, {
      limitInputPixels: 25_000_000,
    }).metadata();

    if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) {
      res.status(415).json({
        success: false,
        message: "Only JPEG, PNG, and WebP images are supported.",
      });
      return;
    }

    // Normalize orientation, remove embedded metadata, and limit dimensions.
    const processedImage = await sharp(file.buffer, {
      limitInputPixels: 25_000_000,
    })
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();

    storageKey = `users/${userId}/${randomUUID()}.webp`;

    await storePhoto(storageKey, processedImage);

    const photo = await prisma.userPhoto.create({
      data: {
        userId,
        storageKey,
        contentType: "image/webp",
        sizeBytes: processedImage.length,
        isPrimary: existingCount === 0,
        position: existingCount,
      },
    });

    storageKey = undefined;

    const url = await getPhotoUrl(photo.storageKey);

    res.status(201).json({
      success: true,
      message: "Photo uploaded successfully.",
      photo: {
        id: photo.id,
        url,
        contentType: photo.contentType,
        sizeBytes: photo.sizeBytes,
        isPrimary: photo.isPrimary,
        position: photo.position,
        createdAt: photo.createdAt,
      },
    });
  } catch (error) {
    // If the database write failed after uploading the object, attempt to
    // remove the orphaned object without hiding the original error.
    if (storageKey) {
      try {
        await removeStoredPhoto(storageKey);
      } catch (cleanupError) {
        console.error("Could not clean up uploaded photo:", cleanupError);
      }
    }

    next(error);
  }
});

router.patch("/:photoId/primary", async (req, res, next) => {
  try {
    const userId = res.locals.userId as string;
    const photoId = req.params.photoId;

    const photo = await prisma.userPhoto.findFirst({
      where: { id: photoId, userId },
      select: { id: true },
    });

    if (!photo) {
      res.status(404).json({
        success: false,
        message: "Photo not found.",
      });
      return;
    }

    await prisma.$transaction([
      prisma.userPhoto.updateMany({
        where: { userId },
        data: { isPrimary: false },
      }),
      prisma.userPhoto.update({
        where: { id: photo.id },
        data: { isPrimary: true },
      }),
    ]);

    res.json({
      success: true,
      message: "Primary photo updated successfully.",
      photoId: photo.id,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:photoId", async (req, res, next) => {
  try {
    const userId = res.locals.userId as string;
    const photoId = req.params.photoId;

    const photo = await prisma.userPhoto.findFirst({
      where: { id: photoId, userId },
    });

    if (!photo) {
      res.status(404).json({
        success: false,
        message: "Photo not found.",
      });
      return;
    }

    // Delete the private object before removing its database record.
    await removeStoredPhoto(photo.storageKey);

    await prisma.$transaction(async (tx) => {
      await tx.userPhoto.delete({
        where: { id: photo.id },
      });

      if (photo.isPrimary) {
        const nextPhoto = await tx.userPhoto.findFirst({
          where: { userId },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        });

        if (nextPhoto) {
          await tx.userPhoto.update({
            where: { id: nextPhoto.id },
            data: { isPrimary: true },
          });
        }
      }
    });

    res.json({
      success: true,
      message: "Photo deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
