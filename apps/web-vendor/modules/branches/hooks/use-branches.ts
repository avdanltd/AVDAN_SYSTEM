import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { branchesService, type JoinRequestPayload } from '../services/branches.service'

export function useMyBusiness() {
  return useQuery({ queryKey: ['my-business'], queryFn: branchesService.get, refetchInterval: 60_000 })
}

export function useBusinessSuggestions(q: string) {
  return useQuery({
    queryKey: ['business-suggest', q],
    queryFn: () => branchesService.suggest(q),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  })
}

export function useBranchActions() {
  const qc = useQueryClient()
  const done = () => void qc.invalidateQueries({ queryKey: ['my-business'] })
  const onError = (e: Error) => toast.error(e.message ?? 'Something went wrong.')
  return {
    request: useMutation({
      mutationFn: (p: JoinRequestPayload) => branchesService.request(p),
      onSuccess: () => toast.success('Sent to AVDAN. We will check it and let you know.'),
      onError,
      onSettled: done,
    }),
    cancel: useMutation({ mutationFn: branchesService.cancel, onError, onSettled: done }),
    leave: useMutation({
      mutationFn: branchesService.leave,
      onSuccess: () => toast.success('Your store now shows on its own.'),
      onError,
      onSettled: done,
    }),
  }
}
