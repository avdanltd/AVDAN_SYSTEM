'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '../ui/button'
import { PasswordInput } from '../ui/password-input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../forms/form'

const schema = z
  .object({
    current: z.string().min(1, 'Enter your current password'),
    next: z.string().min(8, 'Use at least 8 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })

type Values = z.infer<typeof schema>

export interface ChangePasswordFormProps {
  pending: boolean
  onSubmit: (values: { current_password: string; new_password: string }, reset: () => void) => void
}

/** Current password + new password. The app wires the request; `reset` clears the form after a
 *  successful change. */
export function ChangePasswordForm({ pending, onSubmit }: ChangePasswordFormProps) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { current: '', next: '', confirm: '' },
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) =>
          onSubmit({ current_password: v.current, new_password: v.next }, () => form.reset()),
        )}
        className="max-w-sm space-y-4"
      >
        <FormField
          control={form.control}
          name="current"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="next"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
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
              <FormLabel>Confirm new password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Change password'}
        </Button>
      </form>
    </Form>
  )
}
