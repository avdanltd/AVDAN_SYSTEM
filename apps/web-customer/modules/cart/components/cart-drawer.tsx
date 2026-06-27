'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Button,
  cn,
} from '@avdan/ui'
import { useCartStore } from '../store/cart.store'
import { ROUTES } from '@/config/routes'

function formatPrice(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kobo / 100)
}

interface CartDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const router = useRouter()
  const { items, updateQuantity, removeItem, totalKobo, vendorName, itemCount } = useCartStore()
  const count = itemCount()

  function handleCheckout() {
    onOpenChange(false)
    router.push(ROUTES.checkout)
  }

  function handleStartShopping() {
    onOpenChange(false)
    router.push(ROUTES.products)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Your Cart
            {count > 0 && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                ({count} item{count === 1 ? '' : 's'})
              </span>
            )}
          </SheetTitle>
          {vendorName && (
            <p className="text-xs text-muted-foreground">From {vendorName}</p>
          )}
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 py-10 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Your cart is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">Add items from our vendors to get started.</p>
            </div>
            <Button onClick={handleStartShopping} className="mt-2">
              Start Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {items.map((item) => (
                <div key={item.product_id} className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
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
                        <ShoppingCart className="h-5 w-5 opacity-30" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground line-clamp-2 leading-tight">
                        {item.name}
                      </p>
                      <button
                        onClick={() => removeItem(item.product_id)}
                        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">
                        {formatPrice(item.price_kobo * item.quantity)}
                      </span>
                      {/* Quantity stepper */}
                      <div className="flex items-center gap-1 rounded-lg border border-border">
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-l-lg',
                            'text-muted-foreground hover:bg-secondary transition-colors',
                          )}
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-6 text-center text-xs font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-r-lg',
                            'text-muted-foreground hover:bg-secondary transition-colors',
                          )}
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <SheetFooter className="flex-col gap-3 border-t border-border px-5 pt-4 pb-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold text-foreground text-base">{formatPrice(totalKobo())}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Delivery fee calculated at checkout.
                </p>
              </div>
              <Button className="w-full" size="lg" onClick={handleCheckout}>
                Proceed to Checkout
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
