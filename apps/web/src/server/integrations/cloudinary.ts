import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { getEnv, missingVars } from '../env';
import { configMissing } from '../errors';

function configure() {
  const env = getEnv();
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw configMissing('Media storage (Cloudinary)', missingVars('media', env));
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return env;
}

export type ResourceType = 'image' | 'video' | 'raw';

export interface SignedUpload {
  uploadUrl: string;
  fields: Record<string, string>;
}

/** Parameters signed server-side; the browser uploads directly to Cloudinary with them. */
export function signUpload(params: { publicId: string; folder: string; resourceType: ResourceType; allowedFormats?: string[] }): SignedUpload {
  const env = configure();
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign: Record<string, string | number> = {
    timestamp,
    public_id: params.publicId,
    folder: params.folder,
    overwrite: 'false',
  };
  if (params.allowedFormats?.length) toSign.allowed_formats = params.allowedFormats.join(',');
  const signature = cloudinary.utils.api_sign_request(toSign, env.CLOUDINARY_API_SECRET!);
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${params.resourceType}/upload`,
    fields: {
      ...Object.fromEntries(Object.entries(toSign).map(([k, v]) => [k, String(v)])),
      api_key: env.CLOUDINARY_API_KEY!,
      signature,
    },
  };
}

/** Verifies the signature Cloudinary returns with every upload response. */
export function verifyUploadResponse(publicId: string, version: number, signature: string): boolean {
  const env = configure();
  const expected = cloudinary.utils.api_sign_request({ public_id: publicId, version }, env.CLOUDINARY_API_SECRET!);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function deliveryUrl(publicId: string, resourceType: ResourceType, version: number, format?: string): string {
  const env = configure();
  const ext = format ? `.${format}` : '';
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/v${version}/${publicId}${ext}`;
}

export function videoPosterUrl(publicId: string, version: number): string {
  const env = configure();
  return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/video/upload/so_0,f_jpg,q_auto/v${version}/${publicId}.jpg`;
}

export async function destroyAsset(publicId: string, resourceType: ResourceType): Promise<void> {
  configure();
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
}
