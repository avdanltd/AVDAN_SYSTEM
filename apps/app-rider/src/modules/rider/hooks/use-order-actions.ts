import { useMutation, useQueryClient } from '@tanstack/react-query'

import { riderService } from '../services/rider.service'
import type { RiderOrderAction } from '../types'
import { toast } from '@avdan/mobile'

export function useOrderAction(orderId: string) {
  const queryClient = useQueryClient()

  // A transition can move an order out of the active queue and into history, so both
  // lists plus this order's own detail cache have to be refreshed.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['rider-orders'] })
    queryClient.invalidateQueries({ queryKey: ['rider-order-history'] })
    queryClient.invalidateQueries({ queryKey: ['rider-order', orderId] })
  }

  const pickup = useMutation({
    mutationFn: () => riderService.pickupOrder(orderId),
    onSuccess: () => {
      invalidate()
      toast.success('Pickup confirmed', 'Head to the hub when you are ready.')
    },
    onError: (e: Error) => toast.error('Could not confirm pickup', e.message),
  })

  const transit = useMutation({
    mutationFn: () => riderService.transitOrder(orderId),
    onSuccess: () => {
      invalidate()
      toast.success('Marked in transit', 'Dispatch can see you are en route.')
    },
    onError: (e: Error) => toast.error('Could not update status', e.message),
  })

  const deliver = useMutation({
    mutationFn: () => riderService.deliverOrder(orderId),
    onSuccess: () => {
      invalidate()
      toast.success('Delivery confirmed', 'This order has moved to your history.')
    },
    onError: (e: Error) => toast.error('Could not confirm delivery', e.message),
  })

  const fail = useMutation({
    mutationFn: () => riderService.failOrder(orderId),
    onSuccess: () => {
      invalidate()
      toast.info('Failed delivery reported', 'Dispatch has been notified.')
    },
    onError: (e: Error) => toast.error('Could not report failure', e.message),
  })

  const execute = (action: RiderOrderAction) => {
    if (action === 'pickup') pickup.mutate()
    else if (action === 'transit') transit.mutate()
    else if (action === 'deliver') deliver.mutate()
    else if (action === 'fail') fail.mutate()
  }

  const isPending = pickup.isPending || transit.isPending || deliver.isPending || fail.isPending

  return { execute, isPending }
}
