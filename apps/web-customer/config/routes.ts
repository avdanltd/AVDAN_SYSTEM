export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',

  vendors: '/vendors',
  vendor: (slug: string) => `/vendors/${slug}`,

  orders: '/orders',
  order: (id: string) => `/orders/${id}`,
  orderTrack: (id: string) => `/orders/${id}/track`,

  cart: '/cart',
  checkout: '/checkout',

  checkoutSuccess: '/checkout/success',
  checkoutFailed: '/checkout/failed',

  profile: '/profile',
  notifications: '/notifications',
} as const
