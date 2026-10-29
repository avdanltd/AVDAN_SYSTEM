import { apiClient } from '../../lib/api-client'

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  message: string
  access_token?: string | null
  refresh_token?: string | null
}

export interface User {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  role: string
  status: string
}

export const authService = {
  login: (payload: LoginPayload) => apiClient.post<LoginResponse>('/auth/login', payload),

  logout: () => apiClient.post<{ message: string }>('/auth/logout', {}),

  getMe: () => apiClient.get<User>('/auth/me'),

  /** Registers this device's Expo push token for the signed-in user. */
  savePushToken: (token: string) =>
    apiClient.patch<{ message: string }>('/auth/me/push-token', { token }),

  /** Detaches this device from the user on sign-out so their pushes stop arriving here. */
  clearPushToken: () => apiClient.delete<{ message: string }>('/auth/me/push-token'),

  updateMe: (payload: Partial<Pick<User, 'name' | 'phone'>>) =>
    apiClient.patch<User>('/auth/me', payload),
}
