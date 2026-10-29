import { apiClient } from '@/lib/api-client'

// Mirrors PresignUploadRequest/PresignUploadResponse in services/storage/schemas.py.
// Bytes never pass through our API here — this is the presign-then-direct-PUT-to-R2 flow
// already used by the mobile apps (see packages/mobile/src/lib/uploads.ts). Web reuses the
// same contract so a product photo costs the API no memory and no request time.
export interface PresignUploadResponse {
  upload_url: string
  key: string
  public_url: string | null
  content_type: string
  expires_in: number
}

export const uploadsService = {
  presign: (params: { prefix: 'products'; content_type: string; content_length: number }) =>
    apiClient.post<PresignUploadResponse>('/uploads/presign', params),
}
