export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',

  users: '/users',
  user: (id: string) => `/users/${id}`,

  orders: '/orders',
  order: (id: string) => `/orders/${id}`,

  categories: '/categories',

  vendors: '/vendors',
  products: '/products',
  productsOfVendor: (vendorId: string) => `/products/vendor/${vendorId}`,
  vendor: (id: string) => `/vendors/${id}`,

  disputes: '/disputes',
  dispute: (id: string) => `/disputes/${id}`,

  escrow: '/escrow',
  payouts: '/payouts',
  reviews: '/reviews',
  finance: '/finance',
  dispatch: '/dispatch',
  hubs: '/hubs',
  analytics: '/analytics',
  config: '/config',
  notifications: '/notifications',
  profile: '/profile',
} as const
