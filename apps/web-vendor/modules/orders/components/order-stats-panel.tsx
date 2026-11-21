'use client'

import { useState } from 'react'
import { ORDER_GROUP_COLORS, bucketLabel, presetRange, type RangePreset } from '@avdan/types'
import { Card, CardContent, DateRangeBar, Skeleton, cn } from '@avdan/ui'
import { formatPrice } from '@/lib/format'
import { useOrderStats } from '../hooks/use-order-stats'

/**
 * Order numbers for the store at a glance: how many orders in the chosen period, split by where
 * they stand (awaiting payment, in progress, delivered, release pending, completed, cancelled,
 * disputes), with a day / week / month histogram. Tap a status to narrow the chart to it.
 */
export function OrderStatsPanel() {
  const [preset, setPreset] = useState<RangePreset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [group, setGroup] = useState('')

  const range = preset === 'custom' ? { from: customFrom, to: customTo } : presetRange(preset)
  const params: Record<string, string> = {}
  if (range.from) params.date_from = range.from
  if (range.to) params.date_to = range.to
  if (group) params.group = group

  const { data, isLoading, isError } = useOrderStats(params)
  const unit = data?.bucket ?? 'day'
  const series = data?.series ?? []
  const max = Math.max(1, ...series.map((p) => p.total))

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-4">
        <DateRangeBar
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onPreset={setPreset}
          onCustomFrom={setCustomFrom}
          onCustomTo={setCustomTo}
        />

        {isError ? (
          <p className="text-sm text-destructive">Couldn&apos;t load your order numbers.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Orders in this period</p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-9 w-20" />
                ) : (
                  <p className="font-display text-3xl font-semibold tabular-nums text-foreground">{data?.total ?? 0}</p>
                )}
                {data && (
                  <p className="text-xs text-muted-foreground">{formatPrice(data.value_kobo)} in paid orders (your prices)</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(data?.groups ?? []).map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setGroup(group === g.key ? '' : g.key)}
                    aria-pressed={group === g.key}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      group === g.key
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-secondary',
                    )}
                  >
                    <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: ORDER_GROUP_COLORS[g.key] }} />
                    {g.label} <span className="tabular-nums">{g.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-40">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (data?.total ?? 0) === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No orders in this period.</p>
              ) : (
                <div className="flex h-full items-end gap-1" role="img" aria-label="Orders per period, by status">
                  {series.map((p) => (
                    <div
                      key={p.bucket}
                      className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                      title={`${bucketLabel(p.bucket, unit)}: ${p.total} order${p.total === 1 ? '' : 's'}`}
                    >
                      <div className="flex w-full flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(p.total / max) * 85}%` }}>
                        {Object.entries(p.by_group).map(([key, n]) => (
                          <div key={key} style={{ height: `${(n / p.total) * 100}%`, background: ORDER_GROUP_COLORS[key] }} />
                        ))}
                      </div>
                      <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                        {series.length <= 14 || series.indexOf(p) % Math.ceil(series.length / 8) === 0
                          ? bucketLabel(p.bucket, unit)
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
