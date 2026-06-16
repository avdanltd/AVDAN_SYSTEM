import { apiClient } from '@/lib/api-client'
import type { PlatformConfig, AuditLogEntry } from '../types'
import type { PaginatedResponse } from '@avdan/types'

export const configService = {
  getConfig: () => apiClient.get<PlatformConfig>('/admin/config'),

  updateConfig: (payload: Partial<PlatformConfig>) =>
    apiClient.patch<PlatformConfig>('/admin/config', payload),

  getAuditLog: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<AuditLogEntry>>('/admin/audit-log', params),
}
