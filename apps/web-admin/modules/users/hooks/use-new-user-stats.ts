import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { usersService } from '../services/users.service'

export function useNewUserStats(params: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-new-user-stats', params],
    queryFn: () => usersService.getNewUserStats(params),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })
}
