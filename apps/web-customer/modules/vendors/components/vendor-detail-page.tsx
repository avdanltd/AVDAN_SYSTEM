'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  cn,
  toast,
} from '@avdan/ui'
import { ShoppingCart } from 'lucide-react'
import { useVendor } from '../hooks/use-vendor'
import { useCartStore } from '@/modules/cart/store/cart.store'
import type { Product } from '../types'

function formatPrice(kobo: number): string {
  return (kobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

interface AddToCartButtonProps {
  product: Product
  vendorId: string
  vendorName: string
}

function AddToCartButton({ product, vendorId, vendorName }: AddToCartButtonProps) {
  const { addItem, vendorId: cartVendorId, vendorName: cartVendorName, clearCart } = useCartStore()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const isDifferentVendor = cartVendorId !== null && cartVendorId !== vendorId

  function doAdd() {
    addItem({
      product_id: product.id,
      vendor_id: vendorId,
      name: product.name,
      price_kobo: product.price_kobo,
      quantity: 1,
      image_url: product.image_urls[0] ?? null,
      vendorName,
    })
    toast.success(`${product.name} added to cart`)
  }

  function handleClick() {
    if (!product.available || product.stock_qty === 0) return
    if (isDifferentVendor) {
      setConfirmOpen(true)
    } else {
      doAdd()
    }
  }

  function handleConfirm() {
    clearCart()
    doAdd()
    setConfirmOpen(false)
  }

  return (
    <>
      <Button
        size="sm"
        className="gap-1.5"
        disabled={!product.available || product.stock_qty === 0}
        onClick={handleClick}
      >
        <ShoppingCart className="h-3.5 w-3.5" />
        {product.available && product.stock_qty > 0 ? 'Add to cart' : 'Unavailable'}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Replace cart?"
        description={`Adding this item will clear your current cart from ${cartVendorName ?? 'another vendor'}. Continue?`}
        confirmLabel="Replace cart"
        cancelLabel="Keep current cart"
        destructive
        onConfirm={handleConfirm}
      />
    </>
  )
}

interface ProductCardProps {
  product: Product
  vendorId: string
  vendorName: string
}

function ProductCard({ product, vendorId, vendorName }: ProductCardProps) {
  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
      <div className="relative aspect-[4/3] w-full bg-muted">
        {product.image_urls[0] ? (
          <Image
            src={product.image_urls[0]}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-12 w-12 opacity-30">
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
        )}
        {!product.available || product.stock_qty === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Badge variant="secondary" className="text-xs font-medium">Out of stock</Badge>
          </div>
        ) : null}
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground line-clamp-1">{product.name}</h3>
        {product.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{product.description}</p>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-bold text-foreground">{formatPrice(product.price_kobo)}</span>
          <AddToCartButton product={product} vendorId={vendorId} vendorName={vendorName} />
        </div>
      </CardContent>
    </Card>
  )
}

export function VendorDetailPage({ slug }: { slug: string }) {
  const { data: vendor, isLoading, error } = useVendor(slug)

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Hero skeleton */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-5">
            <Skeleton className="h-20 w-20 rounded-full shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-7 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        </div>
        {/* Products skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <div className="flex justify-between pt-1">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error || !vendor) {
    return (
      <EmptyState
        title="Vendor not found"
        description="This vendor may no longer be available."
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Vendor hero */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-5">
          <Avatar className="h-20 w-20 shrink-0 border-2 border-border text-2xl">
            {vendor.logo_url ? <AvatarImage src={vendor.logo_url} alt={vendor.name} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">
              {getInitials(vendor.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{vendor.name}</h1>
              <Badge
                variant={vendor.status === 'active' ? 'default' : 'secondary'}
                className={cn(vendor.status === 'active' && 'bg-green-100 text-green-700 hover:bg-green-100')}
              >
                {vendor.status === 'active' ? 'Open' : vendor.status}
              </Badge>
            </div>
            {vendor.description && (
              <p className="mt-2 text-muted-foreground leading-relaxed">{vendor.description}</p>
            )}
            <div className="mt-3 flex items-center gap-1">
              {vendor.rating !== null ? (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-amber-400">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-semibold text-foreground">{vendor.rating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">rating</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">No ratings yet</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products section */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Menu ({vendor.products.length} items)
        </h2>
        {vendor.products.length === 0 ? (
          <EmptyState
            title="No products available"
            description="This vendor hasn't added any products yet."
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" x2="21" y1="6" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vendor.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                vendorId={vendor.id}
                vendorName={vendor.name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
