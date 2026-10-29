'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { CategoryIcon } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useCategories } from '../hooks/use-categories'
import { useProducts } from '@/modules/products/hooks/use-products'
import { ProductGrid } from '@/modules/products/components/product-grid'
import { ProductFilters, type FilterState } from '@/modules/products/components/product-filters'
import { ProductPagination } from '@/modules/products/components/product-pagination'
import type { ProductsParams } from '@/modules/products/types'

interface CategoryProductsPageProps {
  slug: string
}

const LIMIT = 12

export function CategoryProductsPage({ slug }: CategoryProductsPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: categoriesData } = useCategories()
  // Categories resolve via a client-only fetch that can complete before hydration
  // finishes on a fast connection, which would make the server (always "not found
  // yet") and client first-render diverge structurally. Gate on `mounted` so the
  // first client render matches the server's fallback state.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const categories = mounted ? categoriesData : undefined
  const category = categories?.find((c) => c.slug === slug)

  const sort = (searchParams.get('sort') ?? 'popular') as ProductsParams['sort']
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const minPrice = searchParams.get('min_price') ?? undefined
  const maxPrice = searchParams.get('max_price') ?? undefined
  const availableOnly = searchParams.get('available') === '1'

  const { data, isLoading, error } = useProducts({
    category_id: category?.id,
    sort,
    page,
    limit: LIMIT,
    min_price_kobo: minPrice ? Math.round(Number(minPrice) * 100) : undefined,
    max_price_kobo: maxPrice ? Math.round(Number(maxPrice) * 100) : undefined,
    ...(availableOnly ? { available_only: true } : {}),
  })

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1
  const basePath = ROUTES.category(slug)

  const filters: FilterState = {
    sort: sort ?? 'popular',
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
      router.push(`${basePath}?${p.toString()}`)
    },
    [searchParams, router, basePath],
  )

  function handleFilterChange(patch: Partial<FilterState>) {
    const update: Record<string, string | undefined> = {}
    if ('sort' in patch) update.sort = patch.sort !== 'popular' ? patch.sort : undefined
    if ('minPrice' in patch) update.min_price = patch.minPrice || undefined
    if ('maxPrice' in patch) update.max_price = patch.maxPrice || undefined
    if ('availableOnly' in patch) update.available = patch.availableOnly ? '1' : undefined
    setParams(update)
  }

  function handleReset() { router.push(basePath) }

  function handlePage(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    router.push(`${basePath}?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href={ROUTES.home} className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href={ROUTES.categories} className="hover:text-foreground">Categories</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{category?.name ?? slug}</span>
      </nav>

      {category ? (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-secondary/50 p-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-background shadow-sm">
            <CategoryIcon name={category.icon} className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{category.name}</h1>
            {category.description && (
              <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
            )}
          </div>
        </div>
      ) : (
        <h1 className="text-2xl font-bold tracking-tight text-foreground capitalize">{slug}</h1>
      )}

      <ProductFilters
        filters={filters}
        totalResults={data?.total}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      <ProductGrid
        products={data?.items}
        loading={isLoading || (!category && !!categories)}
        error={error}
        emptyTitle="No products in this category"
        emptyDescription="Try adjusting your filters or check back later."
      />

      <ProductPagination page={page} totalPages={totalPages} onPageChange={handlePage} />
    </div>
  )
}
