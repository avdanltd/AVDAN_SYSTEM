export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',

  users: '/users',
  user: (id: string) => `/users/${id}`,

  orders: '/orders',
  order: (id: string) => `/orders/${id}`,

  vendors: '/vendors',
  vendor: (id: string) => `/vendors/${id}`,

  disputes: '/disputes',
  dispute: (id: string) => `/disputes/${id}`,

  escrow: '/escrow',
  dispatch: '/dispatch',
  hubs: '/hubs',
  analytics: '/analytics',
  config: '/config',
  profile: '/profile',
} as const
