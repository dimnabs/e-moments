import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { SOLO_PHOTO_STRIP } from "../domain/constants";
import { StorageConfigurationError } from "../domain/errors";
import type { DownloadablePhotoStrip, StoredObject } from "../domain/types";
import type { ObjectStorageRepository } from "./object-storage-repository";

type StorageConfig = { accessKeyId: string; bucket: string; endpoint: string; publicEndpoint: string; region: string; secretAccessKey: string };

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new StorageConfigurationError(`Missing required environment variable: ${name}`);
  return value;
}

function storageConfig(): StorageConfig {
  const endpoint = requiredEnvironment("S3_ENDPOINT");
  return {
    accessKeyId: requiredEnvironment("S3_ACCESS_KEY"),
    bucket: requiredEnvironment("S3_BUCKET"),
    endpoint,
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT?.trim() || endpoint,
    region: process.env.S3_REGION?.trim() || "us-east-1",
    secretAccessKey: requiredEnvironment("S3_SECRET_KEY"),
  };
}

function s3Client(config: StorageConfig, endpoint: string) {
  return new S3Client({ credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }, endpoint, forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false", region: config.region });
}

async function ensureBucket(client: S3Client, bucket: string) {
  try { await client.send(new HeadBucketCommand({ Bucket: bucket })); } catch {
    try { await client.send(new CreateBucketCommand({ Bucket: bucket })); } catch (error) {
      const errorName = error instanceof Error ? error.name : "";
      if (errorName !== "BucketAlreadyOwnedByYou" && errorName !== "BucketAlreadyExists") throw error;
    }
  }
}

export class S3ObjectStorageRepository implements ObjectStorageRepository {
  async storePrivateObjects(objects: StoredObject[]) {
    const config = storageConfig();
    const client = s3Client(config, config.endpoint);
    await ensureBucket(client, config.bucket);
    await Promise.all(objects.map(({ key, body, contentType }) => client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "private, no-store" }))));
  }

  async createDownloadUrl(key: string): Promise<DownloadablePhotoStrip> {
    const config = storageConfig();
    const signingClient = s3Client(config, config.publicEndpoint);
    const expiresAt = new Date(Date.now() + SOLO_PHOTO_STRIP.signedUrlTtlSeconds * 1000).toISOString();
    const downloadUrl = await getSignedUrl(signingClient, new GetObjectCommand({ Bucket: config.bucket, Key: key, ResponseContentDisposition: 'attachment; filename="e-moment-photo-strip.png"', ResponseContentType: "image/png" }), { expiresIn: SOLO_PHOTO_STRIP.signedUrlTtlSeconds });

    return { downloadUrl, expiresAt };
  }
}
