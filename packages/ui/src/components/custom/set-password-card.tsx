'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { PasswordInput } from '../ui/password-input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../forms/form'
import { Logo } from './logo'

const schema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })

type Values = z.infer<typeof schema>

export interface SetPasswordCardProps {
  /** Who the invitation is for; null while loading or when the link is bad. */
  invitee: { name: string | null; email: string | null } | null
  loading: boolean
  /** Set when the link is invalid or expired. */
  linkError: string | null
  submitting: boolean
  submitError: string | null
  done: boolean
  onSubmit: (password: string) => void
  /** `reset` is the forgot-password flow; `invite` (default) is a new account's first password. */
  mode?: 'invite' | 'reset'
  /** Rendered after success: a link or note telling them where to sign in. */
  signInSlot: React.ReactNode
}

/** Landing page for the emailed "create your password" link. App-agnostic: the app supplies the
 *  data and the submit handler. */
export function SetPasswordCard({
  invitee,
  loading,
  linkError,
  submitting,
  submitError,
  done,
  onSubmit,
  signInSlot,
  mode = 'invite',
}: SetPasswordCardProps) {
  const reset = mode === 'reset'
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })

  let body: React.ReactNode
  if (loading) {
    body = <p className="text-sm text-muted-foreground">Checking your link…</p>
  } else if (linkError) {
    body = <p className="text-sm text-destructive">{linkError}</p>
  } else if (done) {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {reset ? 'Your password has been reset.' : 'Your password is set.'} You can sign in now.
        </p>
        {signInSlot}
      </div>
    )
  } else {
    body = (
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => onSubmit(v.password))} className="space-y-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="At least 8 characters" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Saving…' : reset ? 'Reset password' : 'Set password'}
          </Button>
        </form>
      </Form>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Logo href="/" size="lg" className="mb-2" />
          <CardTitle>
            {reset ? 'Reset your password' : invitee?.name ? `Welcome, ${invitee.name}` : 'Create your password'}
          </CardTitle>
          <CardDescription>
            {invitee?.email
              ? `Choose a new password for ${invitee.email}.`
              : reset
                ? 'Choose a new password for your account.'
                : 'Choose a password to finish setting up your account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
    </div>
  )
}
