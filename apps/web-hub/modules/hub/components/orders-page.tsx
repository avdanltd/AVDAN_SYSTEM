'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
  OrderStatusBadge,
  type Column,
  DataTable,
} from '@avdan/ui'
import { ArrowRight, Package } from 'lucide-react'
import { ROUTES } from '@/config/routes'
import { formatKobo, formatDate, formatRelativeTime } from '@/lib/format'
import { useInboundOrders } from '../hooks/use-inbound-orders'
import { useReceiveOrder } from '../hooks/use-receive-order'
import type { HubOrder } from '../types'

type TabValue = 'inbound' | 'qa' | 'dispatched' | 'all'

const TAB_STATUS_MAP: Record<TabValue, string | undefined> = {
  inbound: 'AT_HUB',
  qa: 'QA_IN_PROGRESS',
  dispatched: 'OUT_FOR_DELIVERY,DELIVERED,COMPLETED',
  all: undefined,
}

function OrdersTable({ tab }: { tab: TabValue }) {
  const router = useRouter()
  const { mutate: receiveOrder, isPending: isReceiving } = useReceiveOrder()
  const statusParam = TAB_STATUS_MAP[tab]
  const params: Record<string, string> = {}
  if (statusParam) params.status = statusParam

  const { data, isLoading } = useInboundOrders(params)
  const orders = (data?.items ?? []).slice().sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  const columns: Column<HubOrder>[] = [
    {
      key: 'id',
      header: 'Order ID',
      cell: (row) => (
        <span className="font-mono text-sm font-medium">
          #{row.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      key: 'vendor',
      header: 'Vendor',
      cell: (row) => (
        <span className="text-sm">{row.vendor_name ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <OrderStatusBadge status={row.status} />,
    },
    {
      key: 'items',
      header: 'Items',
      cell: (row) => (
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          {row.items?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      cell: (row) => (
        <span className="text-sm font-medium">{formatKobo(row.total_kobo)}</span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      cell: (row) => (
        <span className="text-sm text-muted-foreground" title={formatDate(row.created_at)}>
          {formatRelativeTime(row.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.status === 'AT_HUB' && (
            <Button
              size="sm"
              className="h-8"
              onClick={(e) => {
                e.stopPropagation()
                receiveOrder(row.id)
              }}
              disabled={isReceiving}
            >
              Receive
            </Button>
          )}
          {row.status === 'QA_IN_PROGRESS' && (
            <Button
              size="sm"
              className="h-8 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={(e) => {
                e.stopPropagation()
                router.push(ROUTES.orderQa(row.id))
              }}
            >
              QA
            </Button>
          )}
          <Link href={ROUTES.order(row.id)} onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ),
    },
  ]

  return (
    <div className="rounded-lg border border-border bg-background shadow-card">
      <DataTable
        columns={columns}
        data={orders}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        skeletonRows={6}
        emptyMessage="No orders in this view."
        onRowClick={(row) => router.push(ROUTES.order(row.id))}
      />
    </div>
  )
}

export function OrdersPage() {
  const [tab, setTab] = useState<TabValue>('inbound')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage inbound, QA, and dispatched orders.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="h-10">
          <TabsTrigger value="inbound" className="px-5">Inbound</TabsTrigger>
          <TabsTrigger value="qa" className="px-5">QA In Progress</TabsTrigger>
          <TabsTrigger value="dispatched" className="px-5">Dispatched</TabsTrigger>
          <TabsTrigger value="all" className="px-5">All</TabsTrigger>
        </TabsList>

        {(['inbound', 'qa', 'dispatched', 'all'] as TabValue[]).map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <OrdersTable tab={t} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
