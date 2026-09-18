'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { toast } from '@avdan/ui'

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

import { registerSchema, type RegisterInput } from '../schemas/auth.schemas'
import { authService } from '../services/auth.service'
import { OtpForm } from './otp-form'

export function RegisterForm() {
  const [step, setStep] = useState<'register' | 'otp'>('register')
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string>('')

  const registerForm = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  })

  const registerMutation = useMutation({
    mutationFn: authService.registerCustomer,
    onSuccess: (data) => {
      setUserId(data.user_id)
      setEmail(registerForm.getValues('email'))
      setStep('otp')
      toast.success('Check your email for the OTP')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (step === 'otp' && userId) {
    return <OtpForm userId={userId} email={email} onBack={() => setStep('register')} />
  }

  return (
    <AuthSplitShell
      imageSrc="/brand/auth-hero.jpg"
      imageAlt="AVDAN delivery rider en route at night"
      badgeSrc="/brand/logo-badge.png"
      tagline="Join thousands shopping local, delivered fast."
      badges={[
        { value: '500+', label: 'Vendors' },
        { value: '10k+', label: 'Orders delivered' },
      ]}
    >
      <Logo size="md" className="mb-8" />
      <h1 className="font-display text-2xl font-bold text-foreground">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">Join AVDAN to start ordering</p>

      <Form {...registerForm}>
        <form
          onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))}
          className="mt-6 space-y-4"
        >
          <FormField
            control={registerForm.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input placeholder="Ada Obi" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={registerForm.control}
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
            control={registerForm.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone number</FormLabel>
                <FormControl>
                  <Input placeholder="+234 800 000 0000" type="tel" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={registerForm.control}
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
          <FormField
            control={registerForm.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" size="lg" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? 'Creating account…' : 'Create account'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href={ROUTES.login} className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </Form>
    </AuthSplitShell>
  )
}
