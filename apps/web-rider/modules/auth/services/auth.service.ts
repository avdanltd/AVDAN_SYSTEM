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

export const authService = {
  login: (payload: LoginPayload) =>
    apiClient.post<{ message: string }>('/auth/login', payload),

  logout: () => apiClient.post<{ message: string }>('/auth/logout', {}),

  getMe: () => apiClient.get<User>('/auth/me'),

  updateMe: (payload: Partial<Pick<User, 'name' | 'phone'>>) =>
    apiClient.patch<User>('/auth/me', payload),
}
