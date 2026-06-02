'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { toast } from '@avdan/ui'

import {
  Button,
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Input,
} from '@avdan/ui'
import { ROUTES } from '@/config/routes'

import { registerSchema, otpSchema, type RegisterInput, type OtpInput } from '../schemas/auth.schemas'
import { authService } from '../services/auth.service'

export function RegisterForm() {
  const [step, setStep] = useState<'register' | 'otp'>('register')
  const [userId, setUserId] = useState<string | null>(null)

  const registerMutation = useMutation({
    mutationFn: authService.registerCustomer,
    onSuccess: (data) => {
      setUserId(data.user_id)
      setStep('otp')
      toast.success('Check your phone for the OTP')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const verifyMutation = useMutation({
    mutationFn: authService.verifyOtp,
    onSuccess: () => {
      toast.success('Account created! Please sign in.')
      window.location.href = ROUTES.login
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const registerForm = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) })
  const otpForm = useForm<OtpInput>({ resolver: zodResolver(otpSchema) })

  if (step === 'otp' && userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Enter OTP</CardTitle>
            <CardDescription>Enter the 6-digit code sent to your phone</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...otpForm}>
              <form
                onSubmit={otpForm.handleSubmit((data) =>
                  verifyMutation.mutate({ user_id: userId, otp: data.otp }),
                )}
                className="space-y-4"
              >
                <FormField
                  control={otpForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OTP Code</FormLabel>
                      <FormControl>
                        <Input placeholder="000000" maxLength={6} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={verifyMutation.isPending}>
                  {verifyMutation.isPending ? 'Verifying…' : 'Verify OTP'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 text-3xl font-bold text-primary">AVDAN</div>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Join AVDAN to start ordering</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...registerForm}>
            <form
              onSubmit={registerForm.handleSubmit((data) => registerMutation.mutate(data))}
              className="space-y-4"
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
                      <Input placeholder="••••••••" type="password" {...field} />
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
                      <Input placeholder="••••••••" type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? 'Creating account…' : 'Create account'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href={ROUTES.login} className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
