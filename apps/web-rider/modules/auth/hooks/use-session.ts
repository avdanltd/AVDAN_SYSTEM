import { useAuthStore } from '../store/auth.store'

export function useSession() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return { user, isAuthenticated, role: user?.role ?? null }
}
