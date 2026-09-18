import { AppShell } from '@/components/layout/app-shell'
import { SessionProvider } from '@/components/common/session-provider'
import { VendorPayoutNudge } from '@/modules/profile/components/vendor-payout-nudge'

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <SessionProvider>
        <VendorPayoutNudge />
        {children}
      </SessionProvider>
    </AppShell>
  )
}
