'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Button,
  EmptyState,
  cn,
} from '@avdan/ui'
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react'
import { useCartStore } from '../store/cart.store'
import { ROUTES } from '@/config/routes'

function formatPrice(kobo: number): string {
  return (kobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })
}

interface CartDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const router = useRouter()
  const { items, updateQuantity, removeItem, totalKobo, vendorName } = useCartStore()

  function handleCheckout() {
    onOpenChange(false)
    router.push(ROUTES.checkout)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Your Cart
            {vendorName && (
              <span className="text-sm font-normal text-muted-foreground">
                — {vendorName}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              title="Your cart is empty"
              description="Add items from a vendor to get started."
              icon={<ShoppingCart className="h-6 w-6" />}
            />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {items.map((item) => (
                <div key={item.product_id} className="flex gap-3 rounded-lg border border-border p-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <ShoppingCart className="h-6 w-6 opacity-30" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2">{item.name}</p>
                    <p className="text-sm font-bold text-foreground">
                      {formatPrice(item.price_kobo * item.quantity)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                    <button
                      onClick={() => removeItem(item.product_id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded border border-border',
                          'hover:bg-secondary transition-colors',
                        )}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded border border-border',
                          'hover:bg-secondary transition-colors',
                        )}
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <SheetFooter className="flex-col gap-3 border-t border-border pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold text-foreground text-base">{formatPrice(totalKobo())}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Delivery fee will be calculated at checkout.
              </p>
              <Button className="w-full" size="lg" onClick={handleCheckout}>
                Checkout
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
