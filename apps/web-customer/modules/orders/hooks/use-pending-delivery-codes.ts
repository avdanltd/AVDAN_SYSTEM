import { useQuery } from '@tanstack/react-query'

import { useSession } from '@/modules/auth/hooks/use-session'
import { ordersService } from '../services/orders.service'

/**
 * Delivery codes the signed-in customer still has to hand to a rider. Polled so the pop-up and
 * the "My Orders" badge appear within seconds of the rider setting off, and clear once the
 * order is delivered (the API stops listing it). Guests and non-customers never fetch.
 */
export function usePendingDeliveryCodes() {
  const { isAuthenticated, role } = useSession()
  return useQuery({
    queryKey: ['pending-delivery-codes'],
    queryFn: ordersService.getPendingDeliveryCodes,
    enabled: isAuthenticated && role === 'customer',
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
}
