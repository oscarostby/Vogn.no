import type { MediaSignInput } from '@vogn/validation';
import type { ApiClient } from './client';
import type { UploadedMedia } from './dto';
import { ApiError } from './http';

interface CloudinaryUploadResponse {
  public_id: string;
  version: number;
  signature: string;
  resource_type: 'image' | 'video' | 'raw';
  format?: string;
  bytes: number;
  width?: number;
  height?: number;
  original_filename?: string;
  error?: { message: string };
}

/**
 * Signed direct upload to the media CDN, then server-side verification + registration.
 * `appendFile` adds the file to the form (web: `form.append('file', file)`; React Native:
 * `form.append('file', { uri, name, type } as never)`).
 */
export async function uploadMedia(
  api: ApiClient,
  input: MediaSignInput,
  appendFile: (form: FormData) => void,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<UploadedMedia> {
  const signed = await api.media.sign(input);
  if (input.size > signed.maxBytes) throw new ApiError('PAYLOAD_TOO_LARGE', 'File is too large', 413);

  const form = new FormData();
  for (const [key, value] of Object.entries(signed.fields)) form.append(key, value);
  appendFile(form);

  let res: Response;
  try {
    res = await fetchImpl(signed.uploadUrl, { method: 'POST', body: form });
  } catch {
    throw new ApiError('NETWORK', 'Upload failed', 0);
  }
  const json = (await res.json().catch(() => ({}))) as CloudinaryUploadResponse;
  if (!res.ok || json.error) {
    throw new ApiError('PROVIDER_ERROR', json.error?.message ?? 'Upload failed', res.status);
  }

  return api.media.complete({
    uploadToken: signed.uploadToken,
    publicId: json.public_id,
    version: json.version,
    signature: json.signature,
    resourceType: json.resource_type,
    format: json.format,
    bytes: json.bytes,
    width: json.width ?? null,
    height: json.height ?? null,
    originalFilename: json.original_filename ?? input.filename ?? null,
  });
}
