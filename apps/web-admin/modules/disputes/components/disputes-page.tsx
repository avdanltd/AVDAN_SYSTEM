'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  DataTable,
  Column,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@avdan/ui'
import { useAdminDisputes } from '../hooks/use-admin-disputes'
import type { AdminDispute } from '../types'
import { formatDate, formatRelativeTime } from '@/lib/format'
import { Pagination } from '@/modules/shared/components/pagination'
import { ROUTES } from '@/config/routes'

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'destructive',
  pending: 'outline',
  resolved: 'secondary',
  closed: 'secondary',
}

function DisputeTable({
  tab,
  onRowClick,
}: {
  tab: 'open' | 'resolved'
  onRowClick: (row: AdminDispute) => void
}) {
  const [page, setPage] = useState(1)

  const params: Record<string, string> = {
    page: String(page),
    limit: '20',
    status: tab === 'open' ? 'open' : 'resolved',
  }

  const { data, isLoading } = useAdminDisputes(params)
  const disputes = data?.items ?? []
  const total = data?.total ?? 0
  const pages = data ? Math.ceil(data.total / (data.page_size || 20)) : 1

  const columns: Column<AdminDispute>[] = [
    {
      key: 'id',
      header: 'Dispute ID',
      cell: (row) => (
        <span className="font-mono text-xs text-foreground">{row.id.slice(0, 12)}…</span>
      ),
    },
    {
      key: 'order_id',
      header: 'Order ID',
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.order_id.slice(0, 12)}…</span>
      ),
    },
    {
      key: 'raised_by',
      header: 'Raised By',
      cell: (row) => (
        <Badge variant="secondary" className="capitalize text-xs">
          {row.raised_by}
        </Badge>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      cell: (row) => (
        <span className="text-sm capitalize">{row.reason.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] ?? 'secondary'} className="capitalize">
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Opened',
      cell: (row) => (
        <span className="text-xs text-muted-foreground" title={formatDate(row.created_at)}>
          {formatRelativeTime(row.created_at)}
        </span>
      ),
    },
  ]

  return (
    <div className="rounded-lg border border-border bg-background shadow-card">
      <DataTable
        columns={columns}
        data={disputes}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        emptyMessage="No disputes found."
        onRowClick={onRowClick}
      />
      <Pagination page={page} pages={pages} total={total} onPageChange={setPage} />
    </div>
  )
}

export function DisputesPage() {
  const router = useRouter()

  function handleRowClick(row: AdminDispute) {
    router.push(ROUTES.dispute(row.id))
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Disputes</h1>
        <p className="text-sm text-muted-foreground">Review and resolve customer disputes</p>
      </div>

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="mt-4">
          <DisputeTable tab="open" onRowClick={handleRowClick} />
        </TabsContent>
        <TabsContent value="resolved" className="mt-4">
          <DisputeTable tab="resolved" onRowClick={handleRowClick} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
