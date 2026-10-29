import { useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorsService } from '../services/vendors.service'
import { toast } from '@avdan/ui'

export function useUpdateVendorStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      vendorsService.updateStatus(id, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] })
      toast.success('Vendor status updated successfully.')
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update vendor status.')
    },
  })
}
