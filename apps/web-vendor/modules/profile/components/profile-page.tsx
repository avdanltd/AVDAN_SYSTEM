'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Skeleton,
  Separator,
  Textarea,
  toast,
} from '@avdan/ui'
import { profileService } from '../services/profile.service'
import type { Bank } from '../services/profile.service'

// ── Account form ───────────────────────────────────────────────────────────────
const accountSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  phone: z.string().min(7, 'Enter a valid phone number').or(z.literal('')).optional(),
})
type AccountFormValues = z.infer<typeof accountSchema>

// ── Business form ──────────────────────────────────────────────────────────────
const businessSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters'),
  description: z.string().optional(),
})
type BusinessFormValues = z.infer<typeof businessSchema>

function AccountForm() {
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth-me'],
    queryFn: profileService.getMe,
  })

  const { mutate: updateMe, isPending } = useMutation({
    mutationFn: profileService.updateMe,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth-me'] })
      toast.success('Account updated')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to update account')
    },
  })

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: '', email: '', phone: '' },
  })

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
      })
    }
  }, [user, form])

  function onSubmit(values: AccountFormValues) {
    updateMe({
      name: values.name,
      email: values.email || undefined,
      phone: values.phone || undefined,
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Your name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="+234 800 000 0000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function BusinessForm() {
  const queryClient = useQueryClient()

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor-catalog'],
    queryFn: profileService.getVendorProfile,
  })

  const { mutate: updateVendor, isPending } = useMutation({
    mutationFn: profileService.updateVendorProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendor-catalog'] })
      toast.success('Business profile updated')
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to update business profile')
    },
  })

  const form = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: { name: '', description: '' },
  })

  useEffect(() => {
    if (vendor) {
      form.reset({
        name: vendor.name ?? '',
        description: vendor.description ?? '',
      })
    }
  }, [vendor, form])

  function onSubmit(values: BusinessFormValues) {
    updateVendor({
      name: values.name,
      description: values.description || undefined,
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Name</FormLabel>
              <FormControl>
                <Input placeholder="Your store or business name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Business Description (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell customers about your business…"
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

const payoutSchema = z.object({
  bank_code: z.string().min(1, 'Select a bank'),
  account_number: z
    .string()
    .length(10, 'Account number must be exactly 10 digits')
    .regex(/^\d+$/, 'Account number must be digits only'),
})
type PayoutFormValues = z.infer<typeof payoutSchema>

function PayoutAccountForm() {
  const queryClient = useQueryClient()
  const [banks, setBanks] = useState<Bank[]>([])
  const [verifiedName, setVerifiedName] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['payout-account'],
    queryFn: profileService.getPayoutAccount,
  })

  useEffect(() => {
    profileService.getBanks().then(setBanks).catch(() => {})
  }, [])

  const form = useForm<PayoutFormValues>({
    resolver: zodResolver(payoutSchema),
    defaultValues: { bank_code: '', account_number: '' },
  })

  const { mutate: saveAccount, isPending: isSaving } = useMutation({
    mutationFn: profileService.savePayoutAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payout-account'] })
      void queryClient.invalidateQueries({ queryKey: ['vendor-catalog'] })
      toast.success('Payout account saved')
      form.reset()
      setVerifiedName(null)
    },
    onError: (error: Error) => {
      toast.error(error.message ?? 'Failed to save payout account')
    },
  })

  async function handleVerify() {
    const { bank_code, account_number } = form.getValues()
    if (!bank_code || account_number.length !== 10) {
      toast.error('Select a bank and enter a 10-digit account number')
      return
    }
    setIsVerifying(true)
    setVerifiedName(null)
    try {
      const result = await profileService.verifyAccount({ account_number, bank_code })
      setVerifiedName(result.account_name)
    } catch {
      toast.error('Could not verify account — check account number and bank')
    } finally {
      setIsVerifying(false)
    }
  }

  function onSubmit(values: PayoutFormValues) {
    if (!verifiedName) {
      toast.error('Verify your account number first')
      return
    }
    const bank = banks.find((b) => b.code === values.bank_code)
    saveAccount({
      account_number: values.account_number,
      bank_code: values.bank_code,
      bank_name: bank?.name ?? values.bank_code,
      account_name: verifiedName,
    })
  }

  if (loadingExisting) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {existing?.has_payout_account && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-medium text-green-800">Payout account linked</p>
          <p className="mt-1 text-green-700">
            {existing.account_name} &mdash; {existing.bank_name}
          </p>
          <p className="text-green-600">
            Account: ****{existing.account_number?.slice(-4)}
          </p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="bank_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bank</FormLabel>
                <FormControl>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e)
                      setVerifiedName(null)
                    }}
                  >
                    <option value="">Select your bank…</option>
                    {banks.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="account_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0123456789"
                    maxLength={10}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e)
                      setVerifiedName(null)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {verifiedName && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Account name: </span>
              <span className="font-semibold text-blue-900">{verifiedName}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleVerify}
              disabled={isVerifying}
            >
              {isVerifying ? 'Verifying…' : 'Verify Account'}
            </Button>
            <Button type="submit" disabled={!verifiedName || isSaving}>
              {isSaving ? 'Saving…' : existing?.has_payout_account ? 'Update Account' : 'Save Account'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

export function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and business information.
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-base">Account Information</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <AccountForm />
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-base">Business Profile</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <BusinessForm />
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-base">Payout Account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Link your Nigerian bank account to receive payments after order delivery.
          </p>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <PayoutAccountForm />
        </CardContent>
      </Card>
    </div>
  )
}
