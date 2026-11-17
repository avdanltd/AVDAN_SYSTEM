'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Card, CardContent, Skeleton, cn } from '@avdan/ui'
import { useNewUserStats } from '../hooks/use-new-user-stats'

const ROLE_LABELS: Record<string, string> = {
  customer: 'Customers',
  vendor: 'Vendors',
  rider: 'Riders',
  agent: 'Hubs',
  support: 'Support',
  admin: 'Admins',
}
const ROLE_ORDER = ['customer', 'vendor', 'rider', 'agent', 'support', 'admin']

function label(bucket: string, unit: string): string {
  const d = new Date(`${bucket}T00:00:00Z`)
  if (unit === 'month') return d.toLocaleDateString('en-NG', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  const base = d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return unit === 'week' ? `Wk ${base}` : base
}

/**
 * "New users" for the period chosen on the Users page: how many accounts joined, split by role
 * (tap a role to filter the list below), and a day / week / month chart. Counts every account
 * created, including customers who haven't verified their email yet.
 */
export function NewUsersPanel({
  params,
  role,
  onRoleChange,
}: {
  params: Record<string, string>
  role: string
  onRoleChange: (role: string) => void
}) {
  const { data, isLoading, isError } = useNewUserStats(params)

  if (isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load the new-user numbers.</p>
  }

  const unit = data?.bucket ?? 'day'
  const chart = (data?.series ?? []).map((p) => ({ name: label(p.bucket, unit), total: p.total, ...p.by_role }))

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">New users in this period</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-9 w-20" />
            ) : (
              <p className="font-display text-3xl font-semibold tabular-nums text-foreground">{data?.total ?? 0}</p>
            )}
            {data && (
              <p className="text-xs text-muted-foreground">
                {data.active} verified · {data.total - data.active} not yet verified
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ROLE_ORDER.map((r) => {
              const n = data?.by_role[r] ?? 0
              const selected = role === r
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRoleChange(selected ? '' : r)}
                  aria-pressed={selected}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-secondary',
                  )}
                >
                  {ROLE_LABELS[r]} <span className="tabular-nums">{n}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-44 w-full">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : chart.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No sign-ups in this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted))' }}
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" name="New users" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
