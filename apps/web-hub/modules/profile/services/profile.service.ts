import { apiClient } from '@/lib/api-client'
import type { User } from '@/modules/auth/services/auth.service'

export interface UpdateProfilePayload {
  name?: string
  phone?: string
}

export const profileService = {
  getMe: () => apiClient.get<User>('/auth/me'),
  updateMe: (payload: UpdateProfilePayload) => apiClient.patch<User>('/auth/me', payload),
}
