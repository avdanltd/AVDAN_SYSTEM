'use client'

import { Navigation, Phone } from 'lucide-react'
import type { IncomingDelivery } from '@avdan/types'

import { Badge, Button, Card, CardContent, EmptyState, Skeleton } from '@avdan/ui'
import { formatRelativeTime } from '@/lib/format'
import { useIncoming } from '../hooks/use-incoming'

const STAGE_LABEL: Record<string, string> = {
  to_vendor: 'Heading to the vendor',
  to_hub: 'On the way here',
  at_hub: 'Arrived at the hub',
}

function etaText(seconds: number | null): string {
  if (seconds === null) return 'No ETA'
  return `~${Math.max(1, Math.round(seconds / 60))} min`
}

// A position older than this is shown as stale rather than presented as live.
const STALE_AFTER_MS = 90_000

function IncomingCard({ row }: { row: IncomingDelivery }) {
  const stale =
    row.location_updated_at === null ||
    Date.now() - new Date(row.location_updated_at).getTime() > STALE_AFTER_MS

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{row.rider_name ?? 'Assigned rider'}</p>
            <Badge variant={row.stage === 'at_hub' ? 'default' : 'secondary'}>
              {STAGE_LABEL[row.stage] ?? row.stage}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Order #{row.order_id.slice(0, 8).toUpperCase()} · {row.item_count}{' '}
            {row.item_count === 1 ? 'item' : 'items'}
            {row.vendor_name ? ` · from ${row.vendor_name}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.location_updated_at === null
              ? 'No location received yet'
              : stale
                ? `Last seen ${formatRelativeTime(row.location_updated_at)}`
                : 'Live location'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-display text-2xl font-semibold tabular-nums text-foreground">
              {row.stage === 'at_hub' ? 'Here' : etaText(row.eta_seconds)}
            </p>
            <p className="text-xs text-muted-foreground">until arrival</p>
          </div>
          {row.rider_phone && (
            <Button asChild variant="outline" size="sm">
              <a href={`tel:${row.rider_phone}`}>
                <Phone className="mr-1.5 h-4 w-4" />
                Call
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function IncomingPage() {
  const { data, isLoading, isError, refetch } = useIncoming()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Incoming</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Riders bringing orders to your hub, nearest first. Updates every few seconds.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={<Navigation className="h-6 w-6" />}
          title="Couldn't load incoming riders"
          description="Check your connection and try again."
          action={{ label: 'Retry', onClick: () => refetch() }}
        />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={<Navigation className="h-6 w-6" />}
          title="Nothing on the way"
          description="When a rider is assigned an order for this hub, they will show up here."
        />
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((row) => (
            <IncomingCard key={row.order_id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}
