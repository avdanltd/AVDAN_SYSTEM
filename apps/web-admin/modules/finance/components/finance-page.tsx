'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Download, Search, Wallet } from 'lucide-react'
import { Button, Card, CardContent, DataTable, Input, Skeleton, Tabs, TabsList, TabsTrigger, type Column } from '@avdan/ui'

import { ROUTES } from '@/config/routes'
import { formatKobo } from '@/lib/format'
import { useFinancePeople, useFinanceSummary } from '../hooks/use-finance'
import { downloadCsv, naira } from '../lib/csv'
import { periodLabel, toPeriod, todayLagos, type PresetKey } from '../lib/period'
import type { FinanceKind, PersonRow } from '../types'
import { PendingReleaseDialog } from './pending-release-dialog'
import { PeriodPicker } from './period-picker'

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-bold tabular-nums ${tone === 'good' ? 'text-success' : ''}`}>{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

const KIND_LABEL: Record<FinanceKind, string> = { vendor: 'Vendors', rider: 'Riders', customer: 'Customers' }

export function FinancePage() {
  const router = useRouter()
  const [preset, setPreset] = useState<PresetKey>('7d')
  const [anchor, setAnchor] = useState(() => Date.now())
  const [from, setFrom] = useState(() => todayLagos())
  const [to, setTo] = useState(() => todayLagos())
  const [kind, setKind] = useState<FinanceKind>('vendor')
  const [query, setQuery] = useState('')
  const [pendingOpen, setPendingOpen] = useState(false)

  const period = useMemo(() => toPeriod(preset, from, to, anchor), [preset, from, to, anchor])
  const label = periodLabel(preset, from, to)
  // Until custom dates are valid there is nothing to ask for; a harmless empty window keeps hooks simple.
  const safe = period ?? { start: new Date(0).toISOString(), end: new Date(1).toISOString() }

  const summary = useFinanceSummary(safe)
  const people = useFinancePeople(kind, safe, query.trim())
  const s = summary.data

  const isCustomer = kind === 'customer'
  const columns: Column<PersonRow>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.name}</p>
          {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
        </div>
      ),
    },
    { key: 'orders', header: 'Orders', cell: (r) => <span className="tabular-nums">{r.orders}</span> },
    {
      key: 'main',
      header: isCustomer ? 'Spent' : 'Earned',
      cell: (r) => <span className="font-semibold tabular-nums">{formatKobo((isCustomer ? r.spent_kobo : r.earned_kobo) ?? 0)}</span>,
    },
    {
      key: 'pending',
      header: isCustomer ? 'Of which not yet released' : 'Paid, not yet released',
      cell: (r) => <span className="tabular-nums text-muted-foreground">{formatKobo(r.pending_kobo)}</span>,
    },
    ...(isCustomer
      ? []
      : [
          { key: 'paid', header: 'Paid out', cell: (r: PersonRow) => <span className="tabular-nums">{formatKobo(r.paid_out_kobo ?? 0)}</span> },
          { key: 'owed', header: 'Owed now', cell: (r: PersonRow) => <span className="tabular-nums">{formatKobo(r.balance_kobo ?? 0)}</span> },
        ]),
  ]

  function exportPeople() {
    const rows = people.data ?? []
    downloadCsv(
      `${kind}s-${label.replaceAll(' ', '-').toLowerCase()}.csv`,
      isCustomer
        ? ['Name', 'Email', 'Orders', 'Spent (NGN)', 'Not yet released (NGN)']
        : ['Name', 'Email', 'Orders', 'Earned (NGN)', 'Paid, not yet released (NGN)', 'Paid out (NGN)', 'Owed now (NGN)'],
      rows.map((r) =>
        isCustomer
          ? [r.name, r.email, r.orders, naira(r.spent_kobo), naira(r.pending_kobo)]
          : [r.name, r.email, r.orders, naira(r.earned_kobo), naira(r.pending_kobo), naira(r.paid_out_kobo), naira(r.balance_kobo)],
      ),
    )
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Financial Tracker</h1>
            <p className="text-sm text-muted-foreground">
              Earnings count once an order&apos;s payment is released. {label}.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPendingOpen(true)} disabled={!period}>
          <Clock className="h-4 w-4" />
          Paid but not yet released
          {s && <span className="font-semibold tabular-nums">{formatKobo(s.pending.customer_paid_kobo)}</span>}
        </Button>
      </div>

      <PeriodPicker
        preset={preset}
        from={from}
        to={to}
        onPreset={(p) => {
          setPreset(p)
          setAnchor(Date.now())
        }}
        onFrom={setFrom}
        onTo={setTo}
        onRefresh={() => {
          setAnchor(Date.now())
          void summary.refetch()
          void people.refetch()
        }}
      />

      {!period && <p className="text-sm text-destructive">Choose a From date that is on or before the To date.</p>}

      {summary.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : summary.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load the totals. Try Refresh.</p>
      ) : s ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="AVDAN earned" tone="good" value={formatKobo(s.released.avdan_total_kobo)}
              hint={`${formatKobo(s.released.avdan_product_kobo)} markup + ${formatKobo(s.released.avdan_delivery_kobo)} delivery`} />
            <Stat label="Vendors earned" value={formatKobo(s.released.vendors_kobo)} hint={`${s.released.orders} released orders`} />
            <Stat label="Riders earned" value={formatKobo(s.released.riders_kobo)} />
            <Stat label="Customers paid (released orders)" value={formatKobo(s.released.customer_paid_kobo)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Paid out to vendors" value={formatKobo(s.payouts.vendors_paid_out_kobo)} />
            <Stat label="Paid out to riders" value={formatKobo(s.payouts.riders_paid_out_kobo)} />
            <Stat label="Withdrawals awaiting payout" value={formatKobo(s.payouts.awaiting_payout_kobo)} hint="requested, not yet paid (right now)" />
          </div>
        </>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={kind} onValueChange={(v) => setKind(v as FinanceKind)}>
          <TabsList>
            {(Object.keys(KIND_LABEL) as FinanceKind[]).map((k) => (
              <TabsTrigger key={k} value={k}>{KIND_LABEL[k]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${KIND_LABEL[kind].toLowerCase()}`} className="pl-9" aria-label="Search" />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 sm:ml-auto" onClick={exportPeople} disabled={!people.data?.length}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-background shadow-card">
        <DataTable
          columns={columns}
          data={people.data ?? []}
          keyExtractor={(r) => r.user_id}
          loading={people.isLoading}
          error={people.isError}
          errorMessage="Couldn't load this list."
          onRetry={() => people.refetch()}
          onRowClick={(r) => router.push(`${ROUTES.finance}/${kind}/${r.user_id}?preset=${preset}${preset === 'custom' ? `&from=${from}&to=${to}` : ''}`)}
          emptyMessage={`No ${KIND_LABEL[kind].toLowerCase()} activity in this period.`}
        />
      </div>
      <p className="text-xs text-muted-foreground">Click a row to see the orders behind the numbers.</p>

      <PendingReleaseDialog open={pendingOpen} onOpenChange={setPendingOpen} period={safe} label={label} />
    </div>
  )
}
