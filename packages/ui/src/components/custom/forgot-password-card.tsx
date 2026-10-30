'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../forms/form'
import { Logo } from './logo'

const schema = z.object({ email: z.string().email('Enter a valid email address') })
type Values = z.infer<typeof schema>

export interface ForgotPasswordCardProps {
  submitting: boolean
  submitted: boolean
  error: string | null
  onSubmit: (email: string) => void
  /** Link back to the sign-in page. */
  backSlot: React.ReactNode
}

/** "Forgot password": ask for the account email and send a reset link. The answer is the same
 *  whether or not the address has an account. */
export function ForgotPasswordCard({ submitting, submitted, error, onSubmit, backSlot }: ForgotPasswordCardProps) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Logo href="/" size="lg" className="mb-2" />
          <CardTitle>Forgot your password?</CardTitle>
          <CardDescription>
            Enter your account email and we&apos;ll send you a link to choose a new one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {submitted ? (
            <p className="text-sm text-muted-foreground">
              If an account exists for that email, a reset link is on its way. It stays valid for an
              hour. Check your spam folder if you don&apos;t see it.
            </p>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => onSubmit(v.email))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="you@example.com" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
            </Form>
          )}
          <div className="text-center text-sm">{backSlot}</div>
        </CardContent>
      </Card>
    </div>
  )
}
