export const ROUTES = {
  home: '/',
  login: '/login',

  orders: '/orders',
  order: (id: string) => `/orders/${id}`,
  orderQa: (id: string) => `/orders/${id}/qa`,

  analytics: '/analytics',
  profile: '/profile',
} as const
