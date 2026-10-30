import { apiClient } from '@/lib/api-client'

export interface LoginPayload {
  email: string
  password: string
}

export interface User {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  role: string
  status: string
}

export interface InvitePreview {
  name: string | null
  email: string | null
  role: string
}

export const authService = {
  forgotPassword: (email: string) =>
    apiClient.post<{ message: string }>('/auth/forgot-password', { email }),

  getPasswordReset: (token: string) =>
    apiClient.get<{ name: string | null; email: string | null; role: string }>(
      `/auth/reset/${encodeURIComponent(token)}`,
    ),

  resetPassword: (payload: { token: string; password: string }) =>
    apiClient.post<{ message: string }>('/auth/reset-password', payload),

  getInvite: (token: string) =>
    apiClient.get<InvitePreview>(`/auth/invite/${encodeURIComponent(token)}`),

  setPassword: (payload: { token: string; password: string }) =>
    apiClient.post<{ message: string }>('/auth/set-password', payload),

  changePassword: (payload: { current_password: string; new_password: string }) =>
    apiClient.post<{ message: string }>('/auth/change-password', payload),

  login: (payload: LoginPayload) =>
    apiClient.post<{ message: string }>('/auth/login', payload),

  logout: () => apiClient.post<{ message: string }>('/auth/logout', {}),

  getMe: () => apiClient.get<User>('/auth/me'),

  updateMe: (payload: Partial<Pick<User, 'name' | 'phone'>>) =>
    apiClient.patch<User>('/auth/me', payload),
}
