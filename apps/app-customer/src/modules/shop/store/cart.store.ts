import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'

import type { CartLine, Product } from '../types'

const STORAGE_KEY = 'avdan_cart'

interface CartState {
  lines: CartLine[]
  hydrated: boolean
  add: (product: Product, quantity?: number) => void
  setQuantity: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  clearVendor: (vendorId: string) => void
  clear: () => void
  hydrate: () => Promise<void>
}

function persist(lines: CartLine[]) {
  // Best-effort: a cart that fails to save is a minor annoyance, not worth surfacing an error.
  SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(lines)).catch(() => {})
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  hydrated: false,

  add: (product, quantity = 1) => {
    const lines = [...get().lines]
    const i = lines.findIndex((l) => l.productId === product.id)
    if (i >= 0) {
      // Never let the cart exceed what the vendor actually has; the server rejects it anyway
      // and failing at checkout is a worse place to find out.
      const next = Math.min(lines[i].quantity + quantity, product.stock_qty)
      lines[i] = { ...lines[i], quantity: next }
    } else {
      lines.push({
        productId: product.id,
        name: product.name,
        priceKobo: product.price_kobo,
        quantity: Math.min(quantity, product.stock_qty),
        imageUrl: product.image_urls?.[0] ?? null,
        stockQty: product.stock_qty,
        vendorId: product.vendor_id,
        vendorName: product.vendor_name,
      })
    }
    set({ lines })
    persist(lines)
  },

  setQuantity: (productId, quantity) => {
    let lines = [...get().lines]
    if (quantity <= 0) {
      lines = lines.filter((l) => l.productId !== productId)
    } else {
      const i = lines.findIndex((l) => l.productId === productId)
      if (i >= 0) lines[i] = { ...lines[i], quantity: Math.min(quantity, lines[i].stockQty) }
    }
    set({ lines })
    persist(lines)
  },

  remove: (productId) => {
    const lines = get().lines.filter((l) => l.productId !== productId)
    set({ lines })
    persist(lines)
  },

  clearVendor: (vendorId) => {
    const lines = get().lines.filter((l) => l.vendorId !== vendorId)
    set({ lines })
    persist(lines)
  },

  clear: () => {
    set({ lines: [] })
    persist([])
  },

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY)
      if (raw) set({ lines: JSON.parse(raw) as CartLine[] })
    } catch {
      // Corrupt or unreadable cart — start empty rather than crash on launch.
    } finally {
      set({ hydrated: true })
    }
  },
}))

/* ── Derived helpers ──────────────────────────────────────────────────────── */

export interface VendorGroup {
  vendorId: string
  vendorName: string
  lines: CartLine[]
  subtotalKobo: number
}

/**
 * Group the cart by vendor.
 *
 * `POST /orders` takes a single `vendor_id`, so a basket spanning three vendors is genuinely
 * three orders — each with its own payment, its own rider and its own escrow. The UI shows that
 * split honestly rather than pretending one checkout exists and failing at the API.
 */
export function groupByVendor(lines: CartLine[]): VendorGroup[] {
  const map = new Map<string, VendorGroup>()
  for (const line of lines) {
    const g = map.get(line.vendorId) ?? {
      vendorId: line.vendorId,
      vendorName: line.vendorName,
      lines: [],
      subtotalKobo: 0,
    }
    g.lines.push(line)
    g.subtotalKobo += line.priceKobo * line.quantity
    map.set(line.vendorId, g)
  }
  return [...map.values()]
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0)
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.priceKobo * l.quantity, 0)
}
