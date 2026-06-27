export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',

  vendors: '/vendors',
  vendor: (slug: string) => `/vendors/${slug}`,

  products: '/products',
  product: (id: string) => `/products/${id}`,

  categories: '/categories',
  category: (slug: string) => `/categories/${slug}`,

  search: '/search',

  orders: '/orders',
  order: (id: string) => `/orders/${id}`,
  orderTrack: (id: string) => `/orders/${id}/track`,

  checkout: '/checkout',
  checkoutSuccess: '/checkout/success',
  checkoutFailed: '/checkout/failed',

  profile: '/profile',
  notifications: '/notifications',
} as const
