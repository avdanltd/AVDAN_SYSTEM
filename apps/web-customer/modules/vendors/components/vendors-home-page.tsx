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
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/15 via-primary/5 to-background px-8 py-12 sm:px-12 sm:py-16">
        <div className="relative z-10 max-w-xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Order from local vendors
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Fresh products, fast delivery. Discover vendors near you.
          </p>
          <div className="mt-6 max-w-md">
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
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
                className="h-11 pl-10 pr-4 text-sm shadow-sm"
              />
            </div>
          </div>
        </div>
        {/* Decorative background circle */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-8 right-16 h-48 w-48 rounded-full bg-primary/5 blur-2xl" />
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {search.trim() ? 'Search results' : 'All vendors'}
        </h2>
        {!isLoading && vendors && vendors.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {vendors.length} vendor{vendors.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <VendorGrid
        vendors={vendors}
        loading={isLoading}
        error={error}
        onBrowseAll={() => setSearch('')}
      />
    </div>
  )
}
