import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { dispatchService } from '../services/dispatch.service'

export function useReadyOrders(page = 1) {
  return useQuery({
    queryKey: ['dispatch-ready', page],
    queryFn: () => dispatchService.getReadyOrders(page),
    refetchInterval: 20_000,
  })
}

export function useInTransitOrders(page = 1) {
  return useQuery({
    queryKey: ['dispatch-in-transit', page],
    queryFn: () => dispatchService.getInTransitOrders(page),
    refetchInterval: 30_000,
  })
}

export function usePickedUpOrders(page = 1) {
  return useQuery({
    queryKey: ['dispatch-picked-up', page],
    queryFn: () => dispatchService.getPickedUpOrders(page),
    refetchInterval: 30_000,
  })
}

export function useAvailableRiders() {
  return useQuery({
    queryKey: ['dispatch-riders'],
    queryFn: () => dispatchService.getAvailableRiders(),
    refetchInterval: 15_000,
  })
}

export function useAssignRider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, riderId }: { orderId: string; riderId?: string }) =>
      dispatchService.assignRider(orderId, riderId),
    onSuccess: (data) => {
      toast.success(`Rider assigned — ${data.message}`)
      void queryClient.invalidateQueries({ queryKey: ['dispatch-ready'] })
      void queryClient.invalidateQueries({ queryKey: ['dispatch-picked-up'] })
      void queryClient.invalidateQueries({ queryKey: ['dispatch-riders'] })
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'No available rider found in this zone')
    },
  })
}

export function useAllRiders() {
  return useQuery({
    queryKey: ['dispatch-all-riders'],
    queryFn: () => dispatchService.getAllRiders(),
  })
}
