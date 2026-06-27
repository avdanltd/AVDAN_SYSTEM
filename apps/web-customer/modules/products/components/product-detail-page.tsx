'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Badge, Button, ConfirmDialog, Skeleton } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useProduct } from '../hooks/use-product'
import { useCartStore } from '@/modules/cart/store/cart.store'
import { ProductGrid } from './product-grid'

function formatPrice(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kobo / 100)
}

interface ProductDetailPageProps {
  productId: string
}

export function ProductDetailPage({ productId }: ProductDetailPageProps) {
  const { data: product, isLoading, error } = useProduct(productId)
  const { addItem, clearCart, vendorId } = useCartStore()
  const [quantity, setQuantity] = useState(1)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [activeImage, setActiveImage] = useState(0)

  function doAddToCart() {
    if (!product) return
    addItem({
      product_id: product.id,
      vendor_id: product.vendor_id,
      vendorName: product.vendor_name,
      name: product.name,
      price_kobo: product.price_kobo,
      quantity,
      image_url: product.image_urls?.[0] ?? null,
    })
    toast.success(`${product.name} added to cart`)
  }

  function handleAddToCart() {
    if (!product) return
    if (vendorId && vendorId !== product.vendor_id) {
      setConfirmOpen(true)
      return
    }
    doAddToCart()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Product not found.</p>
        <Button asChild className="mt-4">
          <Link href={ROUTES.products}>Browse products</Link>
        </Button>
      </div>
    )
  }

  const images = product.image_urls?.length > 0 ? product.image_urls : []
  const currentImage = images[activeImage] ?? null
  const inStock = product.available && product.stock_qty > 0

  return (
    <>
      <div className="space-y-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href={ROUTES.home} className="hover:text-foreground">Home</Link>
          <span>/</span>
          {product.category_name && (
            <>
              <Link
                href={product.category_id ? `${ROUTES.categories}` : ROUTES.products}
                className="hover:text-foreground"
              >
                {product.category_name}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="line-clamp-1 text-foreground font-medium">{product.name}</span>
        </nav>

        {/* Main product layout */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image column */}
          <div className="space-y-3">
            <div className="relative aspect-square overflow-hidden rounded-xl bg-secondary">
              {currentImage ? (
                <Image
                  src={currentImage}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground/30">
                  <ShoppingCart className="h-20 w-20" />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                      i === activeImage ? 'border-primary' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Image src={url} alt={`${product.name} ${i + 1}`} fill className="object-cover" sizes="64px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details column */}
          <div className="flex flex-col gap-4">
            {product.category_name && (
              <Badge variant="secondary" className="w-fit">
                {product.category_name}
              </Badge>
            )}

            <h1 className="text-3xl font-bold tracking-tight text-foreground">{product.name}</h1>

            <Link
              href={ROUTES.vendor(product.vendor_slug)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
            >
              <span className="font-medium">{product.vendor_name}</span>
            </Link>

            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-foreground">
                {formatPrice(product.price_kobo)}
              </span>
              <Badge variant={inStock ? 'secondary' : 'destructive'} className={inStock ? 'bg-green-100 text-green-700' : ''}>
                {inStock ? `In stock (${product.stock_qty})` : 'Out of stock'}
              </Badge>
            </div>

            {product.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            )}

            {/* Quantity stepper */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">Quantity</span>
              <div className="flex items-center gap-1 rounded-lg border border-border">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="flex h-9 w-9 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-8 text-center text-sm font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(product.stock_qty, q + 1))}
                  disabled={quantity >= product.stock_qty}
                  className="flex h-9 w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Add to cart */}
            <div className="flex gap-3">
              <Button
                size="lg"
                disabled={!inStock}
                onClick={handleAddToCart}
                className="flex-1 gap-2"
              >
                <ShoppingCart className="h-4 w-4" />
                {inStock ? 'Add to Cart' : 'Out of Stock'}
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href={ROUTES.vendor(product.vendor_slug)}>
                  Visit Store
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Related products */}
        {product.related_products && product.related_products.length > 0 && (
          <section className="space-y-5">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              More from {product.vendor_name}
            </h2>
            <ProductGrid products={product.related_products} loading={false} skeletonCount={4} />
          </section>
        )}
      </div>

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
