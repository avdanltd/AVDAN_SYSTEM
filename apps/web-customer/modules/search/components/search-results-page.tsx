'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input, EmptyState, cn } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useSearch } from '../hooks/use-search'
import { ProductGrid } from '@/modules/products/components/product-grid'
import { VendorGrid } from '@/modules/vendors/components/vendor-grid'

export function SearchResultsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const initialType = (searchParams.get('type') as 'products' | 'vendors') ?? 'products'

  const [query, setQuery] = useState(q)
  const [activeType, setActiveType] = useState<'products' | 'vendors'>(initialType)

  const { data, isLoading } = useSearch(q, 'all')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    router.push(`${ROUTES.search}?q=${encodeURIComponent(query.trim())}&type=${activeType}`)
  }

  const products = data?.products ?? []
  const vendors = data?.vendors ?? []
  const hasResults = products.length > 0 || vendors.length > 0

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href={ROUTES.home} className="hover:text-foreground">Home</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Search</span>
      </nav>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products or vendors…"
          className="h-12 pl-10 text-base"
        />
      </form>

      {/* Type toggle pills */}
      <div className="flex gap-2">
        {(['products', 'vendors'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={cn(
              'rounded-full px-5 py-2 text-sm font-medium capitalize transition-colors',
              activeType === type
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground',
            )}
          >
            {type} {type === 'products' ? `(${products.length})` : `(${vendors.length})`}
          </button>
        ))}
      </div>

      {q && (
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? 'Searching…'
            : hasResults
            ? `Results for "${q}"`
            : `No results for "${q}"`}
        </p>
      )}

      {!q && (
        <EmptyState
          icon={<Search className="h-10 w-10" />}
          title="Search for products or vendors"
          description="Enter a search term above to find what you're looking for."
        />
      )}

      {q && activeType === 'products' && (
        <ProductGrid
          products={products}
          loading={isLoading}
          emptyTitle="No products found"
          emptyDescription={`No products matched "${q}". Try different keywords.`}
        />
      )}

      {q && activeType === 'vendors' && (
        <VendorGrid
          vendors={vendors}
          loading={isLoading}
          error={null}
        />
      )}
    </div>
  )
}
