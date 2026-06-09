import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usersService } from '../services/users.service'
import { toast } from '@avdan/ui'

export function useUpdateUserStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      usersService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User status updated successfully.')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update user status.')
    },
  })
}
