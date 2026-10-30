'use client'

import { useMutation } from '@tanstack/react-query'
import Link from 'next/link'

import { ForgotPasswordCard } from '@avdan/ui'

import { ROUTES } from '@/config/routes'
import { authService } from '../services/auth.service'

export function ForgotPasswordPage() {
  const send = useMutation({ mutationFn: (email: string) => authService.forgotPassword(email) })

  return (
    <ForgotPasswordCard
      submitting={send.isPending}
      submitted={send.isSuccess}
      error={send.isError ? send.error.message : null}
      onSubmit={(email) => send.mutate(email)}
      backSlot={
        <Link href={ROUTES.login} className="text-primary hover:underline">
          Back to sign in
        </Link>
      }
    />
  )
}
