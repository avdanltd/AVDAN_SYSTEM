import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { vendorsService } from '../services/vendors.service'

/** The conversation with one vendor. Re-checked every 10 s so a reply shows up without a refresh. */
export function useVendorMessages(vendorId: string) {
  return useQuery({
    queryKey: ['admin-vendor-messages', vendorId],
    queryFn: () => vendorsService.getMessages(vendorId),
    refetchInterval: 10_000,
  })
}

export function useSendVendorMessage(vendorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => vendorsService.sendMessage(vendorId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-vendor-messages', vendorId] })
    },
    onError: (err: Error) => toast.error(err.message ?? 'Could not send the message.'),
  })
}
