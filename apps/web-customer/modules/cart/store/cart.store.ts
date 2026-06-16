import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  product_id: string
  vendor_id: string
  name: string
  price_kobo: number
  quantity: number
  image_url: string | null
}

interface CartStore {
  items: CartItem[]
  vendorId: string | null
  vendorName: string | null
  addItem: (item: CartItem & { vendorName: string }) => void
  removeItem: (product_id: string) => void
  updateQuantity: (product_id: string, quantity: number) => void
  clearCart: () => void
  totalKobo: () => number
  itemCount: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      vendorId: null,
      vendorName: null,

      addItem: ({ vendorName, ...item }) => {
        const state = get()
        // If different vendor, the component must handle the confirmation before calling addItem
        if (state.vendorId && state.vendorId !== item.vendor_id) return
        set((s) => {
          const existing = s.items.find((i) => i.product_id === item.product_id)
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.product_id === item.product_id
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i,
              ),
            }
          }
          return {
            items: [...s.items, item],
            vendorId: item.vendor_id,
            vendorName,
          }
        })
      },

      removeItem: (product_id) =>
        set((s) => {
          const items = s.items.filter((i) => i.product_id !== product_id)
          return {
            items,
            vendorId: items.length > 0 ? s.vendorId : null,
            vendorName: items.length > 0 ? s.vendorName : null,
          }
        }),

      updateQuantity: (product_id, quantity) =>
        set((s) => {
          const items =
            quantity <= 0
              ? s.items.filter((i) => i.product_id !== product_id)
              : s.items.map((i) =>
                  i.product_id === product_id ? { ...i, quantity } : i,
                )
          return {
            items,
            vendorId: items.length > 0 ? s.vendorId : null,
            vendorName: items.length > 0 ? s.vendorName : null,
          }
        }),

      clearCart: () => set({ items: [], vendorId: null, vendorName: null }),

      totalKobo: () =>
        get().items.reduce((sum, i) => sum + i.price_kobo * i.quantity, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'avdan-cart' },
  ),
)
