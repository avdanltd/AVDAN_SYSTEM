'use client'

import { EmptyState } from '@avdan/ui'
import type { Vendor } from '../types'
import { VendorCard } from './vendor-card'
import { VendorCardSkeleton } from './vendor-card-skeleton'

interface VendorGridProps {
  vendors: Vendor[] | undefined
  loading: boolean
  error: Error | null
  onBrowseAll?: () => void
}

export function VendorGrid({ vendors, loading, error, onBrowseAll }: VendorGridProps) {
  if (error) {
    return (
      <EmptyState
        title="Could not load vendors"
        description={error.message ?? 'An unexpected error occurred. Please try again.'}
        action={{ label: 'Retry', onClick: () => window.location.reload() }}
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

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <VendorCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!vendors || vendors.length === 0) {
    return (
      <EmptyState
        title="No vendors found"
        description="Try adjusting your search or check back later."
        action={onBrowseAll ? { label: 'Clear search', onClick: onBrowseAll } : undefined}
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        }
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {vendors.map((vendor) => (
        <VendorCard key={vendor.id} vendor={vendor} />
      ))}
    </div>
  )
}
