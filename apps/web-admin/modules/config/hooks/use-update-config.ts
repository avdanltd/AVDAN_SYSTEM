import { useMutation, useQueryClient } from '@tanstack/react-query'
import { configService } from '../services/config.service'
import type { PlatformConfig } from '../types'
import { toast } from '@avdan/ui'

export function useUpdateConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: Partial<PlatformConfig>) => configService.updateConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-platform-config'] })
      toast.success('Configuration updated successfully.')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update configuration.')
    },
  })
}
