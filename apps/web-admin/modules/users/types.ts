import type { UserRole } from '@avdan/types'

export interface AdminUser {
  id: string
  email: string | null
  phone: string | null
  name: string | null
  role: UserRole
  status: string
  created_at: string
}

export interface CreateAdminPayload {
  email: string
  name: string
  password: string
  role: 'admin' | 'support' | 'agent'
}

export interface Hub {
  id: string
  name: string
  active: boolean
  capacity: number
  lat: number | null
  lng: number | null
}

export interface CreateHubPayload {
  name: string
  capacity?: number
  lat?: number | null
  lng?: number | null
}
