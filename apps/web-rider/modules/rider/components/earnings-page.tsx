'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { WalletPanel } from '@avdan/ui'

import { ROUTES } from '@/config/routes'
import { formatKobo } from '@/lib/format'
import { useRequestWithdrawal, useWallet } from '../hooks/use-earnings'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function EarningsPage() {
  const router = useRouter()
  const { summary, entries, requests, refetchAll } = useWallet()
  const withdraw = useRequestWithdrawal()

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <div>
        <h1 className="text-lg font-semibold">Earnings</h1>
        <p className="text-sm text-muted-foreground">
          You earn the delivery fee on every order. It lands in Available as soon as the parcel is delivered.
        </p>
      </div>

      <WalletPanel
        summary={summary.data}
        entries={entries.data?.items}
        requests={requests.data?.items}
        loading={summary.isLoading}
        error={summary.isError}
        onRetry={refetchAll}
        showClearing={false}
        onRequestWithdrawal={async (amountKobo) => {
          await withdraw.mutateAsync(amountKobo)
        }}
        submitting={withdraw.isPending}
        formatMoney={formatKobo}
        formatDate={formatDate}
        onSetupAccount={() => router.push(ROUTES.payoutAccount)}
      />
    </div>
  )
}
