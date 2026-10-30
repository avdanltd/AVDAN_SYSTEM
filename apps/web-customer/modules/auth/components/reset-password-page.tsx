'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { SetPasswordCard, buttonVariants } from '@avdan/ui'

import { ROUTES } from '@/config/routes'
import { authService } from '../services/auth.service'

export function ResetPasswordPage() {
  const token = useSearchParams().get('token') ?? ''

  const reset = useQuery({
    queryKey: ['password-reset', token],
    queryFn: () => authService.getPasswordReset(token),
    enabled: Boolean(token),
    retry: false,
  })
  const save = useMutation({
    mutationFn: (password: string) => authService.resetPassword({ token, password }),
  })

  const linkError = !token
    ? 'This link is incomplete. Open the link from your reset email.'
    : reset.isError
      ? reset.error.message
      : null

  return (
    <SetPasswordCard
      mode="reset"
      invitee={reset.data ?? null}
      loading={Boolean(token) && reset.isPending}
      linkError={linkError}
      submitting={save.isPending}
      submitError={save.isError ? save.error.message : null}
      done={save.isSuccess}
      onSubmit={(password) => save.mutate(password)}
      signInSlot={
        <Link href={ROUTES.login} className={buttonVariants({ className: 'w-full' })}>
          Go to sign in
        </Link>
      }
    />
  )
}
