'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Badge, Button, Column, DataTable, Input } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { Pagination } from '@/modules/shared/components/pagination'
import { useProductVendors } from '../hooks/use-product-vendors'
import type { ProductVendorSummary } from '../types'
import { ProductsPage } from './products-page'

/**
 * Products start from the vendor, not one endless list: each vendor with how many products are
 * live, waiting and rejected (vendors with something waiting first). Click one to review that
 * vendor's catalogue. "Awaiting approval" keeps the old all-vendors queue for working through
 * what is new, whoever it belongs to.
 */
export function ProductsLandingPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'vendors' | 'queue'>('vendors')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const params: Record<string, string> = { page: String(page), page_size: '20' }
  if (search) params.search = search
  const { data, isLoading, isError, refetch } = useProductVendors(params)
  const rows = data?.items ?? []
  const total = data?.total ?? 0
  const pages = data ? Math.ceil(data.total / (data.page_size || 20)) : 1

  const columns: Column<ProductVendorSummary>[] = [
    {
      key: 'vendor',
      header: 'Vendor',
      cell: (row) => (
        <div className="flex items-center gap-3">
          {row.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.logo_url} alt="" className="h-9 w-9 rounded-md object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
              {row.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="font-medium text-foreground">{row.name}</span>
        </div>
      ),
    },
    { key: 'total', header: 'Products', cell: (row) => <span className="tabular-nums">{row.total}</span> },
    { key: 'live', header: 'Live', cell: (row) => <span className="tabular-nums text-success">{row.live}</span> },
    {
      key: 'pending',
      header: 'Awaiting approval',
      cell: (row) =>
        row.pending > 0 ? <Badge variant="outline">{row.pending} waiting</Badge> : <span className="text-muted-foreground">0</span>,
    },
    {
      key: 'rejected',
      header: 'Rejected',
      cell: (row) => <span className="tabular-nums text-muted-foreground">{row.rejected}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Products</h1>
        <p className="text-sm text-muted-foreground">
          Pick a vendor to review their products, or open the queue to work through everything waiting for approval.
        </p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={tab === 'vendors' ? 'default' : 'outline'} onClick={() => setTab('vendors')}>
          By vendor
        </Button>
        <Button size="sm" variant={tab === 'queue' ? 'default' : 'outline'} onClick={() => setTab('queue')}>
          Awaiting approval (all vendors)
        </Button>
      </div>

      {tab === 'queue' ? (
        <ProductsPage embedded />
      ) : (
        <>
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vendors"
              aria-label="Search vendors"
              className="pl-9"
            />
          </div>
          <div className="rounded-lg border border-border bg-background shadow-card">
            <DataTable
              columns={columns}
              data={rows}
              keyExtractor={(row) => row.vendor_id}
              loading={isLoading}
              error={isError}
              errorMessage="Couldn't load vendors."
              onRetry={() => refetch()}
              emptyMessage={search ? `No vendors match "${search}".` : 'No vendor has listed a product yet.'}
              onRowClick={(row) => router.push(ROUTES.productsOfVendor(row.vendor_id))}
            />
            <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  )
}
