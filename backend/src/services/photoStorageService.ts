import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getStorageConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "Photo storage is not configured. Check the R2 environment variables."
    );
  }

  return {
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    accessKeyId,
    secretAccessKey,
    bucket,
  };
}

function createStorageClient(): S3Client {
  const config = getStorageConfig();

  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function storePhoto(
  storageKey: string,
  image: Buffer
): Promise<void> {
  const config = getStorageConfig();
  const client = createStorageClient();

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
        Body: image,
        ContentType: "image/webp",
        CacheControl: "private, max-age=0, no-cache",
      })
    );
  } finally {
    client.destroy();
  }
}

export async function getPhotoUrl(storageKey: string): Promise<string> {
  const config = getStorageConfig();
  const client = createStorageClient();

  try {
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
      }),
      { expiresIn: 900 }
    );
  } finally {
    client.destroy();
  }
}

export async function removeStoredPhoto(storageKey: string): Promise<void> {
  const config = getStorageConfig();
  const client = createStorageClient();

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
      })
    );
  } finally {
    client.destroy();
  }
}
