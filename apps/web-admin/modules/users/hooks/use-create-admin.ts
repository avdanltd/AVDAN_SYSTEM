import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersService } from '../services/users.service'
import type { CreateAdminPayload } from '../types'
import { toast } from '@avdan/ui'

export function useCreateAdmin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateAdminPayload) => usersService.createAdmin(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Admin user created successfully.')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to create admin user.')
    },
  })
}
