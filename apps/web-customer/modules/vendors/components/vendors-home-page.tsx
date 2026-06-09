'use client'

import { useState, useDeferredValue } from 'react'
import { Input } from '@avdan/ui'
import { useVendors } from '../hooks/use-vendors'
import { VendorGrid } from './vendor-grid'

export function VendorsHomePage() {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  const params: Record<string, string> = {}
  if (deferredSearch.trim()) {
    params.search = deferredSearch.trim()
  }

  const { data, isLoading, error } = useVendors(
    Object.keys(params).length > 0 ? params : undefined,
  )

  const vendors = data?.items

  return (
    <div className="space-y-6">
      {/* Hero / search bar */}
      <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Discover Vendors
        </h1>
        <p className="mt-1 text-muted-foreground">
          Browse local vendors and order fresh products delivered to your door.
        </p>
        <div className="mt-4 max-w-md">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <Input
              placeholder="Search vendors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Results count */}
      {!isLoading && vendors && (
        <p className="text-sm text-muted-foreground">
          {vendors.length === 0
            ? 'No vendors found'
            : `${vendors.length} vendor${vendors.length === 1 ? '' : 's'} found`}
        </p>
      )}

      <VendorGrid
        vendors={vendors}
        loading={isLoading}
        error={error}
        onBrowseAll={() => setSearch('')}
      />
    </div>
  )
}
