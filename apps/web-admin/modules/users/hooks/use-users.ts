import { useQuery } from '@tanstack/react-query'
import { usersService } from '../services/users.service'

export function useUsers(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => usersService.getUsers(params),
  })
}
