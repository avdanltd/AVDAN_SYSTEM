'use client'

import { useState } from 'react'
import { Banknote, Clock } from 'lucide-react'
import type { PayoutRequest } from '@avdan/types'

import { Badge, Column, DataTable, StatsCard, Tabs, TabsList, TabsTrigger } from '@avdan/ui'
import { formatDate, formatKobo } from '@/lib/format'
import { Pagination } from '@/modules/shared/components/pagination'
import { usePayouts } from '../hooks/use-payouts'
import { PayoutDetailDialog } from './payout-detail-dialog'
import { STATUS_LABEL, STATUS_VARIANT } from './status'

const TABS = [
  { value: 'REQUESTED', label: 'Needs review' },
  { value: 'PROCESSING', label: 'Sending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'ALL', label: 'All' },
] as const

export function PayoutsPage() {
  const [tab, setTab] = useState<string>('REQUESTED')
  const [ownerType, setOwnerType] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)

  const params: Record<string, string> = { page: String(page), page_size: '20' }
  if (tab !== 'ALL') params.status = tab
  if (ownerType !== 'ALL') params.owner_type = ownerType
  const query = usePayouts(params)
  const items = query.data?.items ?? []
  const pages = query.data ? Math.ceil(query.data.total / (query.data.page_size || 20)) : 1

  const columns: Column<PayoutRequest>[] = [
    {
      key: 'owner',
      header: 'Requester',
      cell: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.owner_name ?? '—'}</p>
          <p className="text-xs capitalize text-muted-foreground">{r.owner_type}</p>
        </div>
      ),
    },
    {
      key: 'requested',
      header: 'Requested',
      cell: (r) => <span className="font-medium tabular-nums">{formatKobo(r.requested_kobo)}</span>,
    },
    {
      key: 'approved',
      header: 'Approved',
      cell: (r) => (
        <span className="tabular-nums">{r.approved_kobo != null ? formatKobo(r.approved_kobo) : '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{STATUS_LABEL[r.status] ?? r.status}</Badge>,
    },
    {
      key: 'created',
      header: 'Requested on',
      cell: (r) => <span className="text-sm text-muted-foreground">{formatDate(r.created_at)}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Vendors and riders request withdrawals from their wallets. Nothing is paid until you approve an
          amount here — approval sends the transfer to their saved bank account.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatsCard
          title="Awaiting your approval"
          value={query.data ? query.data.pending_count : '—'}
          icon={<Clock className="h-5 w-5" />}
          loading={query.isLoading}
          tone="accent"
        />
        <StatsCard
          title="Total requested (pending)"
          value={query.data ? formatKobo(query.data.pending_kobo) : '—'}
          icon={<Banknote className="h-5 w-5" />}
          loading={query.isLoading}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(1) }}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={ownerType} onValueChange={(v) => { setOwnerType(v); setPage(1) }}>
          <TabsList>
            <TabsTrigger value="ALL">Everyone</TabsTrigger>
            <TabsTrigger value="vendor">Vendors</TabsTrigger>
            <TabsTrigger value="rider">Riders</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <DataTable
          columns={columns}
          data={items}
          keyExtractor={(r) => r.id}
          loading={query.isLoading}
          error={query.isError}
          errorMessage="Couldn't load payout requests."
          onRetry={() => query.refetch()}
          emptyMessage="No payout requests here."
          onRowClick={(r) => setSelected(r.id)}
        />
        <Pagination page={page} pages={pages} total={query.data?.total ?? 0} onPageChange={setPage} />
      </div>

      <PayoutDetailDialog id={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
