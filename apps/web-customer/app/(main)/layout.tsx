import { AppShell } from '@/components/layout/app-shell'
import { DeliveryCodePopup } from '@/modules/orders/components/delivery-code-popup'
import { ReviewPromptPopup } from '@/modules/reviews/components/review-prompt-popup'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <DeliveryCodePopup />
      <ReviewPromptPopup />
    </AppShell>
  )
}
