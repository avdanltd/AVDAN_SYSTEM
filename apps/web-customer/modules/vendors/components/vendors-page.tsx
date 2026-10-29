'use client'

import Link from 'next/link'
import { ROUTES } from '@/config/routes'
import { useVendors } from '../hooks/use-vendors'
import { VendorGrid } from './vendor-grid'

export function VendorsPage() {
  const { data, isLoading, error } = useVendors({ status: 'active' })

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href={ROUTES.home} className="hover:text-foreground">Home</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Vendors</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">All Vendors</h1>
        {data && (
          <p className="text-sm text-muted-foreground">
            {data.total} vendor{data.total === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <VendorGrid
        vendors={data?.items}
        loading={isLoading}
        error={error}
      />
    </div>
  )
}
