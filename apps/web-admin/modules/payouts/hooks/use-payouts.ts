import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'

import { payoutsService } from '../services/payouts.service'

export function usePayouts(params: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-payouts', params],
    queryFn: () => payoutsService.list(params),
    refetchInterval: 30_000,
  })
}

export function usePayout(id: string | null) {
  return useQuery({
    queryKey: ['admin-payout', id],
    queryFn: () => payoutsService.get(id as string),
    enabled: id !== null,
  })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-payouts'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-attention'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-payout'] })
  }
}

export function useApprovePayout() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (v: { id: string; approvedKobo: number; note: string | null; pin: string }) =>
      payoutsService.approve(v.id, v.approvedKobo, v.note, v.pin),
    onSuccess: () => {
      invalidate()
      toast.success('Approved — the transfer has been sent to the bank.')
    },
    onError: (error: Error) => toast.error(error.message ?? 'Could not approve this request'),
  })
}

export function useRejectPayout() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (v: { id: string; note: string }) => payoutsService.reject(v.id, v.note),
    onSuccess: () => {
      invalidate()
      toast.success('Request rejected — funds returned to the wallet.')
    },
    onError: (error: Error) => toast.error(error.message ?? 'Could not reject this request'),
  })
}

export function usePayoutPinStatus() {
  return useQuery({ queryKey: ['admin-payout-pin'], queryFn: () => payoutsService.pinStatus() })
}

export function useSetPayoutPin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (v: { pin: string; currentPassword: string }) =>
      payoutsService.setPin(v.pin, v.currentPassword),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-payout-pin'] })
      toast.success('Payout PIN saved.')
    },
    onError: (error: Error) => toast.error(error.message ?? 'Could not save your PIN'),
  })
}

export function useRefreshPayout() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => payoutsService.refresh(id),
    onSuccess: (request) => {
      invalidate()
      toast.success(
        request.status === 'PROCESSING'
          ? 'Paystack still shows this transfer as in progress.'
          : 'Status updated from Paystack.',
      )
    },
    onError: (error: Error) => toast.error(error.message ?? 'Could not check with Paystack'),
  })
}
