export const ROUTES = {
  home: '/',
  login: '/login',
  register: '/register',

  orders: '/orders',
  order: (id: string) => `/orders/${id}`,

  products: '/products',
  product: (id: string) => `/products/${id}`,
  newProduct: '/products/new',

  earnings: '/earnings',
  profile: '/profile',
  notifications: '/notifications',
} as const
