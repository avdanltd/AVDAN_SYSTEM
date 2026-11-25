'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ORDER_GROUP_COLORS, bucketLabel } from '@avdan/types'

interface Group { key: string; label: string; count: number }
interface Point { bucket: string; total: number; by_group: Record<string, number>; value_kobo?: number }
export interface OrderStatsData {
  bucket: string
  total: number
  value_kobo: number
  groups: Group[]
  series: Point[]
}

const GRID = 'hsl(var(--border))'
const TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }
const TOOLTIP_STYLE = {
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
}

const compact = (kobo: number) => {
  const naira = kobo / 100
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`
  if (naira >= 1_000) return `₦${(naira / 1_000).toFixed(naira >= 10_000 ? 0 : 1)}k`
  return `₦${Math.round(naira)}`
}

/** A caption that explains what a chart is showing, so nobody has to guess. */
function Caption({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-2">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

/**
 * The order charts shared by the admin and vendor dashboards (web):
 *  1. orders per day/week/month, stacked by where each order stands, with real axes and a tooltip
 *     that breaks the bar down;
 *  2. a donut of the status mix over the whole period;
 *  3. the paid order value over time.
 * `valueLabel` says whose money the value is ("paid orders" for admin, "your sales" for a vendor).
 */
export function OrderStatsCharts({
  data,
  formatMoney,
  valueLabel,
}: {
  data: OrderStatsData
  formatMoney: (kobo: number) => string
  valueLabel: string
}) {
  const unit = data.bucket
  const perUnit = unit === 'month' ? 'month' : unit === 'week' ? 'week' : 'day'
  const rows = data.series.map((p) => ({
    ...p.by_group,
    name: bucketLabel(p.bucket, unit),
    total: p.total,
    value: p.value_kobo ?? 0,
  }))
  const tickEvery = Math.max(0, Math.ceil(rows.length / 7) - 1)
  const labelOf = (key: string) => data.groups.find((g) => g.key === key)?.label ?? key
  const mix = data.groups.filter((g) => g.count > 0)
  const mixTotal = mix.reduce((n, g) => n + g.count, 0)
  const hasValue = rows.some((r) => r.value > 0)

  return (
    <div className="space-y-6">
      <div>
        <Caption
          title={`Orders per ${perUnit}`}
          hint="Each bar is one period. Colours show where those orders stand; hover or tap a bar for the breakdown."
        />
        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="name" tick={TICK} interval={tickEvery} tickLine={false} axisLine={{ stroke: GRID }} />
              <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(v, k) => [v as number, labelOf(String(k))]}
                labelFormatter={(l, items) => {
                  const total = (items?.[0]?.payload as { total?: number } | undefined)?.total ?? 0
                  return `${l} · ${total} order${total === 1 ? '' : 's'}`
                }}
              />
              {data.groups.map((g, i) => (
                <Bar
                  key={g.key}
                  dataKey={g.key}
                  name={g.key}
                  stackId="orders"
                  fill={ORDER_GROUP_COLORS[g.key]}
                  radius={i === data.groups.length - 1 ? [3, 3, 0, 0] : 0}
                  maxBarSize={48}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <Caption title="Where your orders stand" hint="Share of all orders in this period, by status." />
          <div className="flex items-center gap-4">
            <div className="relative h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mix} dataKey="count" nameKey="label" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                    {mix.map((g) => (
                      <Cell key={g.key} fill={ORDER_GROUP_COLORS[g.key]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-2xl font-semibold tabular-nums text-foreground">{data.total}</span>
                <span className="text-[11px] text-muted-foreground">orders</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
              {mix.map((g) => (
                <li key={g.key} className="flex items-center gap-2">
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: ORDER_GROUP_COLORS[g.key] }} />
                  <span className="min-w-0 flex-1 truncate text-foreground">{g.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {g.count} · {mixTotal ? Math.round((g.count / mixTotal) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <Caption
            title={`Money in ${valueLabel}`}
            hint={`${formatMoney(data.value_kobo)} in this period, per ${perUnit}. Unpaid and cancelled orders don't count.`}
          />
          <div className="h-40 w-full">
            {hasValue ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rows} margin={{ top: 4, right: 8, left: -4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="orderValueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ORDER_GROUP_COLORS.completed} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={ORDER_GROUP_COLORS.completed} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="name" tick={TICK} interval={tickEvery} tickLine={false} axisLine={{ stroke: GRID }} />
                  <YAxis tick={TICK} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => compact(Number(v))} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v) => [formatMoney(Number(v)), 'Paid value']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={ORDER_GROUP_COLORS.completed}
                    strokeWidth={2}
                    fill="url(#orderValueFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No paid orders in this period yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
