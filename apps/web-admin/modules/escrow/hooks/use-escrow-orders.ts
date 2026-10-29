import { useQuery } from '@tanstack/react-query'
import { escrowService } from '../services/escrow.service'

export function usePendingReleaseOrders(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-escrow-pending', params],
    queryFn: () => escrowService.getPendingRelease(params),
    refetchInterval: 60_000,
  })
}

export function useHeldOrders(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-escrow-held', params],
    queryFn: () => escrowService.getHeld(params),
  })
}
