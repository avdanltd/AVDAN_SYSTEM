'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { SetPasswordCard, buttonVariants } from '@avdan/ui'

import { ROUTES } from '@/config/routes'
import { authService } from '../services/auth.service'

export function SetPasswordPage() {
  const token = useSearchParams().get('token') ?? ''

  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => authService.getInvite(token),
    enabled: Boolean(token),
    retry: false,
  })
  const save = useMutation({
    mutationFn: (password: string) => authService.setPassword({ token, password }),
  })

  const linkError = !token
    ? 'This link is incomplete. Open the link from your invitation email.'
    : invite.isError
      ? invite.error.message
      : null

  return (
    <SetPasswordCard
      invitee={invite.data ?? null}
      loading={Boolean(token) && invite.isPending}
      linkError={linkError}
      submitting={save.isPending}
      submitError={save.isError ? save.error.message : null}
      done={save.isSuccess}
      onSubmit={(password) => save.mutate(password)}
      signInSlot={
        <div className="space-y-3">
          <Link href={ROUTES.login} className={buttonVariants({ className: 'w-full' })}>
            Go to sign in
          </Link>
        </div>
      }
    />
  )
}
