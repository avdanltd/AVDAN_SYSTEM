'use client'

import { useMutation } from '@tanstack/react-query'

import { Card, CardContent, CardDescription, CardHeader, CardTitle, ChangePasswordForm, toast } from '@avdan/ui'

import { authService } from '@/modules/auth/services/auth.service'

export function ChangePasswordCard() {
  const { mutate, isPending } = useMutation({
    mutationFn: authService.changePassword,
    onError: (err: Error) => toast.error(err.message ?? 'Could not change your password.'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Choose a new password for signing in.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChangePasswordForm
          pending={isPending}
          onSubmit={(values, reset) =>
            mutate(values, {
              onSuccess: () => {
                toast.success('Password changed.')
                reset()
              },
            })
          }
        />
      </CardContent>
    </Card>
  )
}
