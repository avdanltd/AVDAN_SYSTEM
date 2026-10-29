import { apiClient } from '@/lib/api-client'
import type { PlatformConfig, AuditLogEntry } from '../types'
import type { PaginatedResponse } from '@avdan/types'

export const configService = {
  // Backend wraps the config dict under a `config` key (`PlatformConfigResponse`) and expects
  // updates wrapped under `updates` (`UpdateConfigRequest`) — not the flat object naively used
  // here before.
  getConfig: async () => {
    const res = await apiClient.get<{ config: PlatformConfig }>('/admin/config')
    return res.config
  },

  updateConfig: async (payload: Partial<PlatformConfig>) => {
    const res = await apiClient.patch<{ config: PlatformConfig }>('/admin/config', {
      updates: payload,
    })
    return res.config
  },

  getAuditLog: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<AuditLogEntry>>('/admin/audit-log', params),
}
