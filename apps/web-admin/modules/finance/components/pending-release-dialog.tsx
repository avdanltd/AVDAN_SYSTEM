'use client'

import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  type Column,
} from '@avdan/ui'
import { Download } from 'lucide-react'
import Link from 'next/link'

import { ROUTES } from '@/config/routes'
import { formatDate, formatKobo } from '@/lib/format'
import { usePendingRelease } from '../hooks/use-finance'
import { downloadCsv, naira } from '../lib/csv'
import type { Period } from '../services/finance.service'
import type { PendingOrder } from '../types'

export function PendingReleaseDialog({
  open,
  onOpenChange,
  period,
  label,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  period: Period
  label: string
}) {
  const { data, isLoading, isError, refetch } = usePendingRelease(period, open)

  const columns: Column<PendingOrder>[] = [
    {
      key: 'order',
      header: 'Order',
      cell: (r) => (
        <Link href={ROUTES.order(r.order_id)} className="font-mono text-xs text-primary hover:underline">
          {r.order_id.slice(0, 8)}
        </Link>
      ),
    },
    { key: 'paid', header: 'Paid', cell: (r) => <span className="text-xs">{r.paid_at ? formatDate(r.paid_at) : '—'}</span> },
    { key: 'customer', header: 'Customer', cell: (r) => <span className="text-sm">{r.customer_name ?? '—'}</span> },
    { key: 'vendor', header: 'Vendor', cell: (r) => <span className="text-sm">{r.vendor_name ?? '—'}</span> },
    { key: 'status', header: 'Stage', cell: (r) => <span className="text-xs capitalize">{r.status.replaceAll('_', ' ').toLowerCase()}</span> },
    { key: 'amount', header: 'Customer paid', cell: (r) => <span className="tabular-nums">{formatKobo(r.customer_paid_kobo)}</span> },
    { key: 'avdan', header: 'AVDAN will earn', cell: (r) => <span className="tabular-nums text-success">{formatKobo(r.avdan_kobo)}</span> },
  ]

  function exportCsv() {
    if (!data) return
    downloadCsv(
      'paid-not-yet-released.csv',
      ['Order', 'Paid at', 'Customer', 'Vendor', 'Stage', 'Customer paid (NGN)', 'Vendor (NGN)', 'Rider (NGN)', 'AVDAN (NGN)'],
      data.orders.map((o) => [
        o.order_id, o.paid_at, o.customer_name, o.vendor_name, o.status,
        naira(o.customer_paid_kobo), naira(o.vendor_kobo), naira(o.rider_kobo), naira(o.avdan_kobo),
      ]),
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Paid but not yet released</DialogTitle>
          <DialogDescription>
            Money customers have paid ({label}) that is still held until delivery completes. It becomes earnings when released.
          </DialogDescription>
        </DialogHeader>
        {data && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span><b className="tabular-nums">{formatKobo(data.totals.customer_paid_kobo)}</b> in {data.totals.orders} orders</span>
            <span className="text-muted-foreground">
              vendors {formatKobo(data.totals.vendors_kobo)} · riders {formatKobo(data.totals.riders_kobo)} · AVDAN {formatKobo(data.totals.avdan_total_kobo)}
            </span>
            <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={exportCsv} disabled={data.orders.length === 0}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        )}
        <div className="rounded-lg border border-border">
          <DataTable
            columns={columns}
            data={data?.orders ?? []}
            keyExtractor={(r) => r.order_id}
            loading={isLoading}
            error={isError}
            errorMessage="Couldn't load these orders."
            onRetry={() => refetch()}
            emptyMessage="Nothing is waiting for release in this period."
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
