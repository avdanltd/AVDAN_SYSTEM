import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'

import { riderService } from '../services/rider.service'
import type { RiderOrderAction } from '../types'

export function useOrderAction(orderId: string) {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['rider-orders'] })
  }

  const pickup = useMutation({
    mutationFn: () => riderService.pickupOrder(orderId),
    onSuccess: () => { invalidate(); toast.success('Pickup confirmed') },
    onError: (e: Error) => toast.error(e.message),
  })

  const transit = useMutation({
    mutationFn: () => riderService.transitOrder(orderId),
    onSuccess: () => { invalidate(); toast.success('Marked in transit to hub') },
    onError: (e: Error) => toast.error(e.message),
  })

  const deliver = useMutation({
    mutationFn: () => riderService.deliverOrder(orderId),
    onSuccess: () => { invalidate(); toast.success('Delivery confirmed') },
    onError: (e: Error) => toast.error(e.message),
  })

  const fail = useMutation({
    mutationFn: () => riderService.failOrder(orderId),
    onSuccess: () => { invalidate(); toast.success('Failed delivery reported') },
    onError: (e: Error) => toast.error(e.message),
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
