import { Suspense } from 'react'

import { SetPasswordPage } from '@/modules/auth/components/set-password-page'

export const metadata = { title: 'Create your password — AVDAN' }

export default function Page() {
  return (
    <Suspense>
      <SetPasswordPage />
    </Suspense>
  )
}
