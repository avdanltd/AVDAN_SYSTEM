import { useQuery } from '@tanstack/react-query'
import { usersService } from '../services/users.service'

/** Users per role and status (the numbers in the Users filter dropdown). */
export function useUserCounts() {
  return useQuery({ queryKey: ['admin-user-counts'], queryFn: usersService.getCounts, refetchInterval: 60_000 })
}
