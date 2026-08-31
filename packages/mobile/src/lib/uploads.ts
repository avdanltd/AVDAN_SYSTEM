import { apiClient } from './api-client'

/**
 * Client half of the presigned-upload flow.
 *
 * The bytes go straight from the device to R2 — they never pass through our API — so a large
 * photo costs the backend no memory and no request time. The API's only job is deciding whether
 * this caller may write to that prefix, and choosing the object key.
 */

export type UploadPrefix = 'products' | 'vendor-logos' | 'qa-evidence'

interface PresignResponse {
  upload_url: string
  key: string
  /** Durable CDN URL. Null for private prefixes, which need a presigned read instead. */
  public_url: string | null
  content_type: string
  expires_in: number
}

export interface UploadResult {
  key: string
  publicUrl: string | null
}

/** Mirrors the server's allow-list. SVG is excluded there because it can carry script. */
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
}

/**
 * Work out the MIME type for a local file URI.
 *
 * `expo-image-picker` gives a `mimeType` on most paths but not all — on some Android providers it
 * comes back undefined — so the extension is the fallback rather than assuming JPEG.
 */
export function guessImageMime(uri: string, provided?: string | null): string {
  const allowed = new Set(Object.values(EXT_TO_MIME))

  // Trust the picker only when it reports a type the server actually accepts. Anything else
  // (undefined, "image/*", "application/octet-stream") falls through to the extension.
  if (provided && allowed.has(provided)) return provided

  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_MIME[ext] ?? 'image/jpeg'
}

/**
 * Upload one local image and return its key plus (for public prefixes) its CDN URL.
 *
 * `fileSize` must be the real byte length: the API pins it into the signature, so a mismatch is
 * rejected by R2 rather than silently storing a truncated object.
 */
export async function uploadImage(params: {
  uri: string
  fileSize: number
  mimeType?: string | null
  prefix: UploadPrefix
  /** Required for qa-evidence, which is filed under its order. */
  orderId?: string
}): Promise<UploadResult> {
  const contentType = guessImageMime(params.uri, params.mimeType)

  const presigned = await apiClient.post<PresignResponse>('/uploads/presign', {
    prefix: params.prefix,
    content_type: contentType,
    content_length: params.fileSize,
    order_id: params.orderId,
  })

  // React Native's fetch streams a file:// URI when given a Blob from it. Reading via fetch()
  // keeps this working on both platforms without pulling in expo-file-system.
  const fileResponse = await fetch(params.uri)
  const blob = await fileResponse.blob()

  const put = await fetch(presigned.upload_url, {
    method: 'PUT',
    // Content-Type must match what was signed, or R2 rejects the signature.
    headers: { 'Content-Type': presigned.content_type },
    body: blob,
  })

  if (!put.ok) {
    throw new Error(
      put.status === 403
        ? 'Upload link expired or was rejected. Try again.'
        : `Upload failed (${put.status}).`,
    )
  }

  return { key: presigned.key, publicUrl: presigned.public_url }
}
