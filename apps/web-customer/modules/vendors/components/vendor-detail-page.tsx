'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Star, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'

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
} from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useVendor } from '../hooks/use-vendor'
import { useCartStore } from '@/modules/cart/store/cart.store'
import { useProducts } from '@/modules/products/hooks/use-products'
import { ProductFilters, type FilterState } from '@/modules/products/components/product-filters'
import { ProductPagination } from '@/modules/products/components/product-pagination'
import type { Product } from '../types'
import type { ProductsParams } from '@/modules/products/types'

const LIMIT = 12

function formatPrice(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(kobo / 100)
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

interface StoreProductCardProps {
  product: Product
  vendorId: string
  vendorName: string
}

function StoreProductCard({ product, vendorId, vendorName }: StoreProductCardProps) {
  const { addItem, vendorId: cartVendorId, vendorName: cartVendorName, clearCart } = useCartStore()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const inStock = product.available && product.stock_qty > 0

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

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (!inStock) return
    if (cartVendorId && cartVendorId !== vendorId) {
      setConfirmOpen(true)
    } else {
      doAdd()
    }
  }

  return (
    <>
      <Card className="group overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary">
          {product.image_urls[0] ? (
            <Image
              src={product.image_urls[0]}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/30">
              <ShoppingCart className="h-12 w-12" />
            </div>
          )}
          {!inStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Badge variant="destructive">Out of stock</Badge>
            </div>
          )}
        </div>
        <CardContent className="flex flex-col gap-2 p-3">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {product.name}
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-base font-bold text-foreground">
              {formatPrice(product.price_kobo)}
            </span>
            <Button
              size="sm"
              disabled={!inStock}
              onClick={handleClick}
              className="h-8 gap-1 text-xs"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Replace cart?"
        description={`Adding this will clear your cart from ${cartVendorName ?? 'another vendor'}. Continue?`}
        confirmLabel="Clear & add"
        destructive
        onConfirm={() => { clearCart(); doAdd() }}
      />
    </>
  )
}

function VendorProductsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="aspect-[4/3] w-full" />
            <CardContent className="p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <div className="flex justify-between">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function VendorProducts({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const sort = (searchParams.get('sort') ?? 'popular') as ProductsParams['sort']
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const minPrice = searchParams.get('min_price') ?? undefined
  const maxPrice = searchParams.get('max_price') ?? undefined
  const availableOnly = searchParams.get('available') === '1'

  const { data, isLoading, error } = useProducts({
    vendor_id: vendorId,
    sort,
    page,
    limit: LIMIT,
    min_price_kobo: minPrice ? Math.round(Number(minPrice) * 100) : undefined,
    max_price_kobo: maxPrice ? Math.round(Number(maxPrice) * 100) : undefined,
    ...(availableOnly ? { available_only: true } : {}),
  })

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1

  const filters: FilterState = {
    sort,
    minPrice: searchParams.get('min_price') ?? '',
    maxPrice: searchParams.get('max_price') ?? '',
    availableOnly,
  }

  const setParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v) p.set(k, v)
        else p.delete(k)
      }
      p.delete('page')
      router.push(`${window.location.pathname}?${p.toString()}`)
    },
    [searchParams, router],
  )

  function handleFilterChange(patch: Partial<FilterState>) {
    const update: Record<string, string | undefined> = {}
    if ('sort' in patch) update.sort = patch.sort !== 'popular' ? patch.sort : undefined
    if ('minPrice' in patch) update.min_price = patch.minPrice || undefined
    if ('maxPrice' in patch) update.max_price = patch.maxPrice || undefined
    if ('availableOnly' in patch) update.available = patch.availableOnly ? '1' : undefined
    setParams(update)
  }

  function handleReset() {
    router.push(window.location.pathname)
  }

  function handlePage(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    router.push(`${window.location.pathname}?${params.toString()}`)
  }

  // The products from the public API are ProductListing, not the vendor's Product type.
  // Adapt them so StoreProductCard still works.
  const adaptedProducts = data?.items?.map((p) => ({
    id: p.id,
    vendor_id: p.vendor_id,
    name: p.name,
    description: p.description,
    price_kobo: p.price_kobo,
    available: p.available,
    stock_qty: p.stock_qty,
    image_urls: p.image_urls,
  })) satisfies Product[] | undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Products</h2>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total} product{data.total === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <ProductFilters
        filters={filters}
        totalResults={data?.total}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full" />
              <CardContent className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-8 w-16 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error || !adaptedProducts ? (
        <EmptyState title="Couldn't load products" description="Please try again." />
      ) : adaptedProducts.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Try adjusting your filters."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
          {adaptedProducts.map((product) => (
            <StoreProductCard
              key={product.id}
              product={product}
              vendorId={vendorId}
              vendorName={vendorName}
            />
          ))}
        </div>
      )}

      <ProductPagination page={page} totalPages={totalPages} onPageChange={handlePage} />
    </div>
  )
}

export function VendorDetailPage({ slug }: { slug: string }) {
  const { data: vendor, isLoading, error } = useVendor(slug)

  if (isLoading) return <VendorProductsSkeleton />

  if (error || !vendor) {
    return (
      <EmptyState
        title="Vendor not found"
        description="This vendor may no longer be available."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href={ROUTES.home} className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href={ROUTES.vendors} className="hover:text-foreground">Vendors</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{vendor.name}</span>
      </nav>

      {/* Store hero */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="relative h-36 bg-gradient-to-br from-primary/20 via-primary/10 to-secondary sm:h-48">
          {vendor.logo_url && (
            <Image
              src={vendor.logo_url}
              alt={vendor.name}
              fill
              className="object-cover opacity-20"
              sizes="100vw"
            />
          )}
        </div>

        <div className="relative px-5 pb-5 pt-1">
          <Avatar className="absolute -top-8 left-5 h-16 w-16 border-4 border-background shadow-md sm:h-20 sm:w-20">
            {vendor.logo_url && <AvatarImage src={vendor.logo_url} alt={vendor.name} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
              {getInitials(vendor.name)}
            </AvatarFallback>
          </Avatar>

          <div className="pt-10 sm:pt-14 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {vendor.name}
                </h1>
                <Badge
                  variant="secondary"
                  className={cn(vendor.status === 'active' && 'bg-green-100 text-green-700')}
                >
                  {vendor.status === 'active' ? 'Open' : vendor.status}
                </Badge>
              </div>
              {vendor.description && (
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-xl">
                  {vendor.description}
                </p>
              )}
              {vendor.rating !== null && (
                <div className="mt-2 flex items-center gap-1 text-sm text-amber-500 font-medium">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {vendor.rating.toFixed(1)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Products with filters */}
      <VendorProducts vendorId={vendor.id} vendorName={vendor.name} />
    </div>
  )
}
