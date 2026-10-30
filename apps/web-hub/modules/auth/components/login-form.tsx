'use client'

import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import {
  Button, Card, CardHeader, CardContent, CardTitle, CardDescription,
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, Input, PasswordInput, Logo,
} from '@avdan/ui'

import { loginSchema, type LoginInput } from '../schemas/auth.schemas'
import { useLogin } from '../hooks/use-login'

export function LoginForm() {
  const { mutate: login, isPending } = useLogin()
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Logo href="/" size="lg" className="mb-2" />
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Welcome back! Please enter your details</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => login(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl><Input placeholder="you@example.com" type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl><PasswordInput placeholder="••••••••" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="text-right">
                <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Signing in...' : 'Sign in'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Contact your hub administrator to create an account.
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
