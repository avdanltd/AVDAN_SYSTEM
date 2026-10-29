export const ROUTES = {
  home: '/',
  login: '/login',
  orders: '/orders',
  order: (id: string) => `/orders/${id}`,
  earnings: '/earnings',
  profile: '/profile',
  payoutAccount: '/profile/payout',
} as const
