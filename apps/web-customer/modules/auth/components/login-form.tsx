'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'

import {
  AuthSplitShell,
  Button,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Input,
  PasswordInput,
  Logo,
} from '@avdan/ui'
import { ROUTES } from '@/config/routes'

import { loginSchema, type LoginInput } from '../schemas/auth.schemas'
import { useLogin } from '../hooks/use-login'

export function LoginForm() {
  const { mutate: login, isPending } = useLogin()

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  return (
    <AuthSplitShell
      imageSrc="/brand/auth-hero.jpg"
      imageAlt="AVDAN delivery rider en route at night"
      badgeSrc="/brand/logo-badge.png"
      tagline="Everything you need, delivered — from trusted local vendors to your door."
      badges={[
        { value: '500+', label: 'Vendors' },
        { value: '10k+', label: 'Orders delivered' },
      ]}
    >
      <Logo size="md" className="mb-8" />
      <h1 className="font-display text-2xl font-bold text-foreground">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to continue to your account</p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((data) => login(data))} className="mt-6 space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <FormControl>
                  <Input placeholder="you@example.com" type="email" {...field} />
                </FormControl>
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
                <FormControl>
                  <PasswordInput placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" size="lg" disabled={isPending}>
            {isPending ? 'Signing in...' : 'Sign in'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href={ROUTES.register} className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </Form>
    </AuthSplitShell>
  )
}
