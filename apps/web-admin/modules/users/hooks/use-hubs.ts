import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersService } from '../services/users.service'
import type { CreateHubPayload } from '../types'

export function useHubs() {
  return useQuery({
    queryKey: ['admin', 'hubs'],
    queryFn: () => usersService.listHubs(),
  })
}

export function useCreateHub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateHubPayload) => usersService.createHub(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'hubs'] })
      toast.success('Hub created')
    },
    onError: () => toast.error('Failed to create hub'),
  })
}

export function useAssignHub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, hubId }: { userId: string; hubId: string | null }) =>
      usersService.assignHub(userId, hubId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success('Agent assigned to hub')
    },
    onError: () => toast.error('Failed to assign hub'),
  })
}
