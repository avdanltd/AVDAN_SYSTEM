import { apiClient } from '@/lib/api-client'

export interface UpdateProfilePayload {
  name?: string
  phone?: string
}

export interface ProfileResponse {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  role: string
  status: string
}

export const profileService = {
  getMe: () => apiClient.get<ProfileResponse>('/auth/me'),
  update: (payload: UpdateProfilePayload) =>
    apiClient.patch<ProfileResponse>('/auth/me', payload),
}
