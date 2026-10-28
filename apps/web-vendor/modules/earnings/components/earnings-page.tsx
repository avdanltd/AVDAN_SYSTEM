'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, WalletPanel } from '@avdan/ui'

import { ROUTES } from '@/config/routes'
import { formatDateTime, formatPrice } from '@/lib/format'
import { useRequestWithdrawal, useWallet } from '../hooks/use-wallet'

export function EarningsPage() {
  const router = useRouter()
  const { summary, entries, requests, refetchAll } = useWallet()
  const withdraw = useRequestWithdrawal()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Earnings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your balances, withdrawals and payment history.
        </p>
      </div>

      <WalletPanel
        summary={summary.data}
        entries={entries.data?.items}
        requests={requests.data?.items}
        loading={summary.isLoading}
        error={summary.isError}
        onRetry={refetchAll}
        showClearing
        onRequestWithdrawal={async (amountKobo) => {
          await withdraw.mutateAsync(amountKobo)
        }}
        submitting={withdraw.isPending}
        formatMoney={formatPrice}
        formatDate={formatDateTime}
        onSetupAccount={() => router.push(ROUTES.profile)}
      />

      <Card className="shadow-card">
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold text-foreground">How your money moves</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li><span className="font-medium text-foreground">Ongoing</span> — a customer has paid; the order is being prepared or delivered.</li>
            <li><span className="font-medium text-foreground">Delivered</span> — the customer has the goods; funds clear after the dispute window.</li>
            <li><span className="font-medium text-foreground">Available</span> — AVDAN&apos;s commission has been deducted and the rest is yours to withdraw.</li>
            <li><span className="font-medium text-foreground">Requested → Paid out</span> — you ask for an amount, an admin approves it, and it is sent to your bank.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
