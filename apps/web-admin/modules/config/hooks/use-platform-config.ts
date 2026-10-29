import { useQuery } from '@tanstack/react-query'
import { configService } from '../services/config.service'

export function usePlatformConfig() {
  return useQuery({
    queryKey: ['admin-platform-config'],
    queryFn: () => configService.getConfig(),
  })
}
