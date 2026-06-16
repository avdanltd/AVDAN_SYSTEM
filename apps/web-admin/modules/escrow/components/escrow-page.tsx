'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, DollarSign } from 'lucide-react'

import {
  DataTable,
  Column,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  StatsCard,
} from '@avdan/ui'
import { usePendingReleaseOrders, useHeldOrders } from '../hooks/use-escrow-orders'
import type { EscrowOrder } from '../types'
import { formatKobo, formatDate } from '@/lib/format'
import { Pagination } from '@/modules/shared/components/pagination'
import { ROUTES } from '@/config/routes'

function getAgeHours(createdAt: string): number {
  return (Date.now() - new Date(createdAt).getTime()) / 3_600_000
}

function AgeCell({ createdAt }: { createdAt: string }) {
  const hours = getAgeHours(createdAt)
  const label = hours < 1 ? '<1h' : hours < 24 ? `${Math.floor(hours)}h` : `${Math.floor(hours / 24)}d`
  const colorClass =
    hours < 24 ? 'text-green-600' : hours < 48 ? 'text-amber-600' : 'text-destructive'
  return <span className={`text-sm font-medium tabular-nums ${colorClass}`}>{label}</span>
}

function EscrowTable({
  tab,
  onRowClick,
}: {
  tab: 'pending' | 'held'
  onRowClick: (row: EscrowOrder) => void
}) {
  const [page, setPage] = useState(1)
  const params = { page: String(page), limit: '20' }

  const pendingQuery = usePendingReleaseOrders(params)
  const heldQuery = useHeldOrders(params)

  const query = tab === 'pending' ? pendingQuery : heldQuery
  const items = (query.data?.items ?? []) as EscrowOrder[]
  const total = query.data?.total ?? 0
  const pages = query.data ? Math.ceil(query.data.total / (query.data.page_size || 20)) : 1

  const columns: Column<EscrowOrder>[] = [
    {
      key: 'order_id',
      header: 'Order ID',
      cell: (row) => (
        <span className="font-mono text-xs text-foreground">{row.id.slice(0, 12)}…</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      cell: (row) => (
        <span className="font-medium tabular-nums">{formatKobo(row.total_kobo)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge variant="secondary" className="text-xs capitalize">
          {row.status.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'age',
      header: 'Age',
      cell: (row) => <AgeCell createdAt={row.created_at} />,
    },
  ]

  return (
    <div className="rounded-lg border border-border bg-background">
      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(row) => row.id}
        loading={query.isLoading}
        emptyMessage="No orders found."
        onRowClick={onRowClick}
      />
      <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
    </div>
  )
}

export function EscrowPage() {
  const router = useRouter()
  const { data: pendingData } = usePendingReleaseOrders({ page: '1', limit: '100' })

  const pendingItems = (pendingData?.items ?? []) as EscrowOrder[]
  const totalHeldKobo = pendingItems.reduce((sum, o) => sum + o.total_kobo, 0)
  const pendingCount = pendingData?.total ?? 0

  function handleRowClick(row: EscrowOrder) {
    router.push(ROUTES.order(row.id))
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Escrow Overview</h1>
        <p className="text-sm text-muted-foreground">
          Monitor held payments — releases are automated via Celery Beat
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatsCard
          title="Total Held (Pending Release)"
          value={formatKobo(totalHeldKobo)}
          icon={<DollarSign className="h-5 w-5" />}
          subtitle="Awaiting automatic release"
        />
        <StatsCard
          title="Pending Release Count"
          value={pendingCount}
          icon={<Clock className="h-5 w-5" />}
          subtitle="Orders due for payout"
        />
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending Release</TabsTrigger>
          <TabsTrigger value="held">Held (Delivered)</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <EscrowTable tab="pending" onRowClick={handleRowClick} />
        </TabsContent>
        <TabsContent value="held" className="mt-4">
          <EscrowTable tab="held" onRowClick={handleRowClick} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
