export const ROUTES = {
  home: '/',
  login: '/login',

  incoming: '/incoming',
  orders: '/orders',
  order: (id: string) => `/orders/${id}`,
  orderQa: (id: string) => `/orders/${id}/qa`,

  analytics: '/analytics',
  profile: '/profile',
} as const
