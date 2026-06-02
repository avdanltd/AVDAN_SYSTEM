import { apiClient } from '@/lib/api-client'

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterCustomerPayload {
  email: string
  phone: string
  password: string
  name: string
}

export interface VerifyOtpPayload {
  user_id: string
  otp: string
}

export interface User {
  id: string
  email: string | null
  phone: string | null
  role: string
  status: string
}

export const authService = {
  login: (payload: LoginPayload) =>
    apiClient.post<{ message: string }>('/auth/login', payload),

  registerCustomer: (payload: RegisterCustomerPayload) =>
    apiClient.post<{ user_id: string; message: string }>('/auth/register/customer', payload),

  verifyOtp: (payload: VerifyOtpPayload) =>
    apiClient.post<{ message: string }>('/auth/verify-otp', payload),

  logout: () => apiClient.post<{ message: string }>('/auth/logout', {}),

  getMe: () => apiClient.get<User>('/auth/me'),
}
