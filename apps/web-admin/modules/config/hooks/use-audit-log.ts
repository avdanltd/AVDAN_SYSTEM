import { useQuery } from '@tanstack/react-query'
import { configService } from '../services/config.service'

export function useAuditLog(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-audit-log', params],
    queryFn: () => configService.getAuditLog(params),
  })
}
