'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { ROUTES } from '@/config/routes'
import { useProducts } from '../hooks/use-products'
import { useCategories } from '@/modules/categories/hooks/use-categories'
import { ProductGrid } from './product-grid'
import { ProductFilters, type FilterState } from './product-filters'
import { ProductPagination } from './product-pagination'
import type { ProductsParams } from '../types'

const LIMIT = 12

function buildParams(searchParams: URLSearchParams): ProductsParams & { page: number } {
  const sort = (searchParams.get('sort') ?? 'popular') as ProductsParams['sort']
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const categoryId = searchParams.get('category_id') ?? undefined
  const minPrice = searchParams.get('min_price') ?? undefined
  const maxPrice = searchParams.get('max_price') ?? undefined
  const availableOnly = searchParams.get('available') === '1'

  return {
    sort,
    page,
    limit: LIMIT,
    category_id: categoryId,
    min_price_kobo: minPrice ? Math.round(Number(minPrice) * 100) : undefined,
    max_price_kobo: maxPrice ? Math.round(Number(maxPrice) * 100) : undefined,
    ...(availableOnly ? { available_only: true } : {}),
  }
}

export function ProductsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const params = buildParams(searchParams)
  const { data: categoriesData } = useCategories()
  // Categories resolve via a client-only fetch that can complete before hydration
  // finishes on a fast connection, which would make the server/client first-render
  // heading text diverge. Gate on `mounted` so it matches the server's "All Products".
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const categories = mounted ? categoriesData : undefined
  const { data, isLoading, error } = useProducts(params)

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1

  const filters: FilterState = {
    sort: searchParams.get('sort') ?? 'popular',
    categoryId: searchParams.get('category_id') ?? undefined,
    minPrice: searchParams.get('min_price') ?? '',
    maxPrice: searchParams.get('max_price') ?? '',
    availableOnly: searchParams.get('available') === '1',
  }

  const setParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const p = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v) p.set(k, v)
        else p.delete(k)
      }
      p.delete('page')
      router.push(`${ROUTES.products}?${p.toString()}`)
    },
    [searchParams, router],
  )

  function handleFilterChange(patch: Partial<FilterState>) {
    const update: Record<string, string | undefined> = {}
    if ('sort' in patch) update.sort = patch.sort !== 'popular' ? patch.sort : undefined
    if ('categoryId' in patch) update.category_id = patch.categoryId
    if ('minPrice' in patch) update.min_price = patch.minPrice || undefined
    if ('maxPrice' in patch) update.max_price = patch.maxPrice || undefined
    if ('availableOnly' in patch) update.available = patch.availableOnly ? '1' : undefined
    setParams(update)
  }

  function handleReset() {
    router.push(ROUTES.products)
  }

  function handlePage(page: number) {
    const p = new URLSearchParams(searchParams.toString())
    p.set('page', String(page))
    router.push(`${ROUTES.products}?${p.toString()}`)
  }

  const selectedCategory = categories?.find((c) => c.id === filters.categoryId)

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href={ROUTES.home} className="hover:text-foreground">Home</Link>
        <span>/</span>
        <span className="text-foreground font-medium">
          {selectedCategory ? selectedCategory.name : 'All Products'}
        </span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {selectedCategory ? selectedCategory.name : 'All Products'}
      </h1>

      <ProductFilters
        filters={filters}
        categories={categories}
        showCategoryFilter
        totalResults={data?.total}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
      />

      <ProductGrid
        products={data?.items}
        loading={isLoading}
        error={error}
        emptyTitle="No products found"
        emptyDescription="Try adjusting your filters."
      />

      <ProductPagination
        page={params.page}
        totalPages={totalPages}
        onPageChange={handlePage}
      />
    </div>
  )
}
