import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'

import { usersService } from '../services/users.service'

export function useResendInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usersService.resendInvite(id),
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(`A new invitation was emailed to ${user.email ?? 'the user'}.`)
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to resend the invitation.'),
  })
}

export function useRevokeInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usersService.revokeInvite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('Invitation revoked.')
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to revoke the invitation.'),
  })
}
