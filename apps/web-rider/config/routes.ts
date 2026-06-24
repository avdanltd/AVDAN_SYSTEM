export const ROUTES = {
  home: '/',
  login: '/login',
  orders: '/orders',
  order: (id: string) => `/orders/${id}`,
  profile: '/profile',
} as const
