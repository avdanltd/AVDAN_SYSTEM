'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MapPin, Star } from 'lucide-react'
import { formatVendorLocation } from '@avdan/types'
import { Avatar, AvatarFallback, AvatarImage, Badge, Card, EmptyState, Skeleton, cn } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { ProductCard } from '@/modules/products/components/product-card'
import { ProductPagination } from '@/modules/products/components/product-pagination'
import { useProducts } from '@/modules/products/hooks/use-products'
import { useBusiness } from '../hooks/use-business'

const LIMIT = 12

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

/**
 * One brand, several branches. Each branch is its own store (its own products, stock and pickup
 * point), so shopping always happens at a branch: pick one below, or browse products from all of
 * them. Every product says which branch it comes from.
 */
export function BusinessPage({ slug }: { slug: string }) {
  const { data: biz, isLoading, error } = useBusiness(slug)
  const [page, setPage] = useState(1)
  const { data: products, isLoading: loadingProducts } = useProducts({ business_slug: slug, page, limit: LIMIT })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }
  if (error || !biz) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <EmptyState title="Business not found" description="It may have been removed, or the link is wrong." />
      </div>
    )
  }

  const totalPages = products ? Math.ceil(products.total / LIMIT) : 1

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border border-border">
          {biz.logo_url && <AvatarImage src={biz.logo_url} alt={biz.name} />}
          <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">{initials(biz.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-foreground">{biz.name}</h1>
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
            <span>{biz.branch_count} branches</span>
            {biz.review_count > 0 && (
              <span className="flex items-center gap-1 font-medium text-warning">
                <Star className="h-3.5 w-3.5 fill-current" />
                {biz.rating.toFixed(1)}
                <span className="font-normal text-muted-foreground">({biz.review_count})</span>
              </span>
            )}
          </p>
          {biz.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{biz.description}</p>}
        </div>
      </div>

      <section aria-labelledby="branches-heading" className="space-y-3">
        <h2 id="branches-heading" className="font-display text-lg font-semibold text-foreground">
          Branches
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {biz.branches.map((b) => {
            const place = formatVendorLocation(b.city, b.state)
            const closed = b.is_open === false
            return (
              <Link key={b.id} href={ROUTES.vendor(b.slug)} className="group block h-full">
                <Card className="flex h-full flex-col gap-2 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-semibold text-foreground group-hover:text-primary">{b.name}</h3>
                    <Badge
                      variant="secondary"
                      className={cn('shrink-0 text-xs', closed ? 'bg-destructive/10 text-destructive' : 'bg-success-muted text-success')}
                    >
                      {closed ? 'Closed' : 'Open'}
                    </Badge>
                  </div>
                  <p className="flex min-h-4 items-center gap-1 text-xs text-muted-foreground">
                    {place && (
                      <>
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="line-clamp-1">{place}</span>
                      </>
                    )}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    {b.review_count && b.review_count > 0 ? (
                      <span className="flex items-center gap-1 text-sm font-medium text-warning">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {b.rating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No ratings yet</span>
                    )}
                    <span className="inline-flex h-7 items-center rounded-md border border-input px-3 text-xs font-medium">
                      Shop this branch
                    </span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="products-heading" className="space-y-3">
        <h2 id="products-heading" className="font-display text-lg font-semibold text-foreground">
          Products from all branches
        </h2>
        {loadingProducts ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        ) : !products || products.items.length === 0 ? (
          <EmptyState title="No products yet" description="These branches haven't listed anything yet." />
        ) : (
          <>
            <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {products.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            <ProductPagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </section>
    </div>
  )
}
