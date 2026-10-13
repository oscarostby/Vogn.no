import 'server-only';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnv, missingVars } from '../env';
import { configMissing } from '../errors';

/**
 * Cloudflare R2 (S3-compatible) private bucket for sensitive files (verification evidence).
 * The bucket must NOT have public access enabled; objects are only reachable through short-lived
 * presigned URLs generated after an authorization check.
 */
let client: S3Client | null = null;

function r2() {
  const env = getEnv();
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
    throw configMissing('Private storage (Cloudflare R2)', missingVars('privateStorage', env));
  }
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    });
  }
  return { client, bucket: env.R2_BUCKET };
}

export function privateStorageConfigured(): boolean {
  return missingVars('privateStorage').length === 0;
}

/** Presigned PUT bound to the exact content type and length (signed headers). */
export async function presignPrivateUpload(key: string, contentType: string, contentLength: number, expiresInSeconds = 600) {
  const { client: c, bucket } = r2();
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: contentLength });
  const url = await getSignedUrl(c, command, { expiresIn: expiresInSeconds, signableHeaders: new Set(['content-type', 'content-length']) });
  return { url, headers: { 'Content-Type': contentType, 'Content-Length': String(contentLength) } };
}

export async function presignPrivateDownload(key: string, expiresInSeconds = 120): Promise<string> {
  const { client: c, bucket } = r2();
  return getSignedUrl(c, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseCacheControl: 'no-store' }), { expiresIn: expiresInSeconds });
}

export async function headPrivateObject(key: string): Promise<{ size: number; contentType: string | null } | null> {
  const { client: c, bucket } = r2();
  try {
    const res = await c.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? null };
  } catch {
    return null;
  }
}

export async function deletePrivateObject(key: string): Promise<void> {
  if (!privateStorageConfigured()) return;
  const { client: c, bucket } = r2();
  await c.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
