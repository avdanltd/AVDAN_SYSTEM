'use client'

import { Card, CardContent, OrderStatsCharts, Skeleton, cn } from '@avdan/ui'
import { formatKobo } from '@/lib/format'
import { useOrderStats } from '../hooks/use-order-stats'

// One colour per status group, shared by the chips and the chart so they read as one system.
const GROUP_COLORS: Record<string, string> = {
  pending: 'hsl(var(--muted-foreground))',
  in_progress: 'hsl(var(--info))',
  delivered: 'hsl(190 70% 40%)',
  release_pending: 'hsl(var(--warning))',
  completed: 'hsl(var(--success))',
  cancelled: 'hsl(var(--destructive))',
  issues: 'hsl(280 60% 55%)',
}

/**
 * "Order numbers" for the period chosen on the Orders page: how many orders were placed, split by
 * where they stand (awaiting payment, in progress, delivered, release pending, completed, cancelled,
 * disputes), with a day / week / month chart. Tap a group to filter the list below.
 */
export function OrderStatsPanel({
  params,
  group,
  onGroupChange,
}: {
  params: Record<string, string>
  group: string
  onGroupChange: (group: string, statuses: string) => void
}) {
  const { data, isLoading, isError } = useOrderStats(params)

  if (isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load the order numbers.</p>
  }

  const groups = data?.groups ?? []

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Orders placed in this period</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-9 w-20" />
            ) : (
              <p className="font-display text-3xl font-semibold tabular-nums text-foreground">{data?.total ?? 0}</p>
            )}
            {data && (
              <p className="text-xs text-muted-foreground">
                {formatKobo(data.value_kobo)} in paid orders (goods + delivery)
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => {
              const selected = group === g.key
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => (selected ? onGroupChange('', '') : onGroupChange(g.key, g.statuses.join(',')))}
                  aria-pressed={selected}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-secondary',
                  )}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: GROUP_COLORS[g.key] ?? 'hsl(var(--muted-foreground))' }}
                  />
                  {g.label} <span className="tabular-nums">{g.count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-60 w-full" />
        ) : !data || data.total === 0 ? (
          <p className="flex h-32 items-center justify-center text-sm text-muted-foreground">No orders in this period.</p>
        ) : (
          <OrderStatsCharts data={data} formatMoney={formatKobo} valueLabel="paid orders" />
        )}
      </CardContent>
    </Card>
  )
}
