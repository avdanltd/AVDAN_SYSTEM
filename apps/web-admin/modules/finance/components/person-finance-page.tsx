'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Download } from 'lucide-react'
import { Badge, Button, Card, CardContent, DataTable, Skeleton, type Column } from '@avdan/ui'

import { ROUTES } from '@/config/routes'
import { formatDate, formatKobo } from '@/lib/format'
import { useFinancePerson } from '../hooks/use-finance'
import { downloadCsv, naira } from '../lib/csv'
import { periodLabel, toPeriod, todayLagos, type PresetKey } from '../lib/period'
import type { FinanceKind, PersonOrderLine } from '../types'
import { PeriodPicker } from './period-picker'

const PRESET_KEYS: PresetKey[] = ['24h', '7d', '30d', 'custom']

export function PersonFinancePage({ kind, userId }: { kind: FinanceKind; userId: string }) {
  const sp = useSearchParams()
  const initial = sp.get('preset') as PresetKey | null
  const [preset, setPreset] = useState<PresetKey>(initial && PRESET_KEYS.includes(initial) ? initial : '30d')
  const [anchor, setAnchor] = useState(() => Date.now())
  const [from, setFrom] = useState(sp.get('from') ?? todayLagos())
  const [to, setTo] = useState(sp.get('to') ?? todayLagos())

  const period = useMemo(() => toPeriod(preset, from, to, anchor), [preset, from, to, anchor])
  const label = periodLabel(preset, from, to)
  const safe = period ?? { start: new Date(0).toISOString(), end: new Date(1).toISOString() }
  const { data, isLoading, isError, refetch } = useFinancePerson(kind, userId, safe)

  const isCustomer = kind === 'customer'
  const columns: Column<PersonOrderLine>[] = [
    {
      key: 'order',
      header: 'Order',
      cell: (r) => <Link href={ROUTES.order(r.order_id)} className="font-mono text-xs text-primary hover:underline">{r.order_id.slice(0, 8)}</Link>,
    },
    { key: 'date', header: 'Date', cell: (r) => <span className="text-xs">{r.date ? formatDate(r.date) : '—'}</span> },
    {
      key: 'state',
      header: 'State',
      cell: (r) => r.state === 'released'
        ? <Badge className="bg-success-muted text-success hover:bg-success-muted">{isCustomer ? 'Paid, released' : 'Earned'}</Badge>
        : <Badge variant="outline">Paid, not yet released</Badge>,
    },
    { key: 'amount', header: isCustomer ? 'Spent' : 'Amount', cell: (r) => <span className="font-semibold tabular-nums">{formatKobo(r.amount_kobo)}</span> },
  ]

  function exportCsv() {
    if (!data) return
    downloadCsv(
      `${data.name.replaceAll(' ', '-').toLowerCase()}-${label.replaceAll(' ', '-').toLowerCase()}.csv`,
      ['Order', 'Date', 'State', 'Amount (NGN)'],
      data.order_lines.map((l) => [l.order_id, l.date, l.state === 'released' ? 'released' : 'not yet released', naira(l.amount_kobo)]),
    )
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <Link href={ROUTES.finance} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Financial Tracker
      </Link>
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">{data?.name ?? 'Loading…'}</h1>
        <p className="text-sm capitalize text-muted-foreground">{kind}{data?.email ? ` · ${data.email}` : ''} · {label}</p>
      </div>

      <PeriodPicker preset={preset} from={from} to={to}
        onPreset={(p) => { setPreset(p); setAnchor(Date.now()) }} onFrom={setFrom} onTo={setTo}
        onRefresh={() => { setAnchor(Date.now()); void refetch() }} />
      {!period && <p className="text-sm text-destructive">Choose a From date that is on or before the To date.</p>}

      {isLoading ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load this {kind}&apos;s figures.</p>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{isCustomer ? 'Spent (released orders)' : 'Earned'}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatKobo(data.released_kobo)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Paid, not yet released</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatKobo(data.pending_kobo)}</p>
            </CardContent></Card>
            {!isCustomer && (
              <>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Paid out</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{formatKobo(data.paid_out_kobo)}</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Owed now</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{formatKobo(data.balance_kobo)}</p>
                  <p className="text-xs text-muted-foreground">wallet balance + withdrawals in flight</p>
                </CardContent></Card>
              </>
            )}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{data.orders} order{data.orders === 1 ? '' : 's'}{data.truncated ? ' (showing the latest 500)' : ''}</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv} disabled={data.order_lines.length === 0}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-background shadow-card">
            <DataTable columns={columns} data={data.order_lines} keyExtractor={(r) => `${r.order_id}-${r.state}`}
              emptyMessage="No orders in this period." />
          </div>
        </>
      ) : null}
    </div>
  )
}
