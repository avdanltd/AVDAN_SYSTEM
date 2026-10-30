import { Suspense } from 'react'

import { ResetPasswordPage } from '@/modules/auth/components/reset-password-page'

export const metadata = { title: 'Reset your password — AVDAN' }

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordPage />
    </Suspense>
  )
}
