import { AppShell } from '@/components/layout/app-shell'
import { DeliveryCodePopup } from '@/modules/orders/components/delivery-code-popup'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <DeliveryCodePopup />
    </AppShell>
  )
}
