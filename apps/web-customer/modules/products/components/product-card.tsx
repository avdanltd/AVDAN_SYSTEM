'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'

import { Badge, Button, Card, CardContent, ConfirmDialog } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useCartStore } from '@/modules/cart/store/cart.store'
import type { ProductListing } from '../types'

function formatPrice(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kobo / 100)
}

interface ProductCardProps {
  product: ProductListing
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem, clearCart, vendorId } = useCartStore()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const imageUrl = product.image_urls?.[0] ?? null

  function doAddToCart() {
    addItem({
      product_id: product.id,
      vendor_id: product.vendor_id,
      vendorName: product.vendor_name,
      name: product.name,
      price_kobo: product.price_kobo,
      quantity: 1,
      image_url: imageUrl,
    })
    toast.success(`${product.name} added to cart`)
  }

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    if (!product.available || product.stock_qty === 0) return
    if (vendorId && vendorId !== product.vendor_id) {
      setConfirmOpen(true)
      return
    }
    doAddToCart()
  }

  return (
    <>
      <Link href={ROUTES.product(product.id)} className="group block">
        <Card className="h-full overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          {/* Image */}
          <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={product.name}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground/30">
                <ShoppingCart className="h-12 w-12" />
              </div>
            )}
            {/* Category badge */}
            {product.category_name && (
              <Badge
                variant="secondary"
                className="absolute left-2 top-2 text-[10px] shadow-sm"
              >
                {product.category_name}
              </Badge>
            )}
            {/* Out of stock overlay */}
            {(!product.available || product.stock_qty === 0) && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Badge variant="destructive">Out of stock</Badge>
              </div>
            )}
          </div>

          <CardContent className="flex flex-col gap-2 p-3">
            {/* Vendor */}
            <Link
              href={ROUTES.vendor(product.vendor_slug)}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
            >
              {product.vendor_name}
            </Link>

            {/* Name */}
            <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
              {product.name}
            </p>

            {/* Price + Add to Cart */}
            <div className="mt-auto flex items-center justify-between gap-2">
              <span className="text-base font-bold text-foreground">
                {formatPrice(product.price_kobo)}
              </span>
              <Button
                size="sm"
                variant={product.available && product.stock_qty > 0 ? 'default' : 'secondary'}
                disabled={!product.available || product.stock_qty === 0}
                onClick={handleAddToCart}
                className="h-8 shrink-0 gap-1 text-xs"
                aria-label={`Add ${product.name} to cart`}
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      </Link>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Replace cart?"
        description="Your cart has items from a different vendor. Adding this item will clear your current cart. Continue?"
        confirmLabel="Clear & add"
        onConfirm={() => {
          clearCart()
          doAddToCart()
        }}
      />
    </>
  )
}
