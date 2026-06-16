'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { toast } from '@avdan/ui'

import {
  Button, Card, CardHeader, CardContent, CardTitle, CardDescription,
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage, Input,
} from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { apiClient } from '@/lib/api-client'
import { OtpForm } from './otp-form'

const vendorRegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  business_name: z.string().min(2, 'Business name required'),
  business_type: z.string().min(2, 'Business type required'),
  description: z.string().min(10, 'Please describe your business'),
})

type VendorRegisterInput = z.infer<typeof vendorRegisterSchema>

export function RegisterVendorForm() {
  const [step, setStep] = useState<'register' | 'otp'>('register')
  const [userId, setUserId] = useState<string | null>(null)

  const registerMutation = useMutation({
    mutationFn: (data: VendorRegisterInput) =>
      apiClient.post<{ user_id: string; message: string }>('/auth/register/vendor', data),
    onSuccess: (data: { user_id: string; message: string }) => {
      setUserId(data.user_id)
      setStep('otp')
      toast.success('Check your phone for the OTP')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const form = useForm<VendorRegisterInput>({ resolver: zodResolver(vendorRegisterSchema) })

  if (step === 'otp' && userId) {
    return <OtpForm userId={userId} onBack={() => setStep('register')} />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 text-3xl font-bold text-primary">AVDAN</div>
          <CardTitle>Register as Vendor</CardTitle>
          <CardDescription>Create your vendor account to start selling</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => registerMutation.mutate(d))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your name</FormLabel>
                    <FormControl><Input placeholder="Ada Obi" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl><Input placeholder="you@business.com" type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone number</FormLabel>
                    <FormControl><Input placeholder="+234 800 000 0000" type="tel" {...field} /></FormControl>
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
                    <FormControl><Input placeholder="••••••••" type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="business_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business name</FormLabel>
                    <FormControl><Input placeholder="Mama's Kitchen" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="business_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business type</FormLabel>
                    <FormControl><Input placeholder="Restaurant, Grocery, Pharmacy..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input placeholder="Tell customers about your business" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? 'Creating account...' : 'Register'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href={ROUTES.login} className="text-primary hover:underline">Sign in</Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
