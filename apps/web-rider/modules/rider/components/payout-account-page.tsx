'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertCircle, ArrowLeft, BadgeCheck } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Skeleton,
  toast,
} from '@avdan/ui'

import { useBanks, usePayoutAccount, useSavePayoutAccount, useVerifyAccount } from '../hooks/use-payout'

const payoutSchema = z.object({
  bank_code: z.string().min(1, 'Select a bank'),
  account_number: z
    .string()
    .length(10, 'Account number must be exactly 10 digits')
    .regex(/^\d+$/, 'Account number must be digits only'),
})
type PayoutFormValues = z.infer<typeof payoutSchema>

/**
 * Payout account setup for web-rider — mirrors app-rider's verify-before-save flow and the
 * form structure established for web-vendor's PayoutAccountForm. The rider picks a bank,
 * types an account number, resolves it to the real account name via Paystack, and only then
 * can save it. Wrong digit + no verification step = money sent to a stranger, which isn't
 * recoverable — so verification is the point of this screen, not friction to route around.
 */
export function PayoutAccountPage() {
  const router = useRouter()
  const [discardOpen, setDiscardOpen] = useState(false)
  const [verifiedName, setVerifiedName] = useState<string | null>(null)

  const { data: existing, isLoading: loadingExisting, isError: existingError, refetch: refetchExisting } =
    usePayoutAccount()
  const { data: banks, isLoading: banksLoading, isError: banksError, refetch: refetchBanks } = useBanks()

  const verify = useVerifyAccount()
  const save = useSavePayoutAccount(() => router.push('/profile'))

  const form = useForm<PayoutFormValues>({
    resolver: zodResolver(payoutSchema),
    defaultValues: { bank_code: '', account_number: '' },
  })

  async function handleVerify() {
    const { bank_code, account_number } = form.getValues()
    if (!bank_code || account_number.length !== 10) {
      toast.error('Select a bank and enter a 10-digit account number')
      return
    }
    setVerifiedName(null)
    verify.mutate(
      { accountNumber: account_number, bankCode: bank_code },
      { onSuccess: (r) => setVerifiedName(r.account_name) },
    )
  }

  function onSubmit(values: PayoutFormValues) {
    if (!verifiedName) {
      toast.error('Verify your account number first')
      return
    }
    const bank = banks?.find((b) => b.code === values.bank_code)
    save.mutate({
      account_number: values.account_number,
      bank_code: values.bank_code,
      bank_name: bank?.name ?? values.bank_code,
      account_name: verifiedName,
    })
  }

  // Changing either input invalidates a previously resolved name — otherwise the rider could
  // confirm one account and save a different number.
  function onFieldChange() {
    setVerifiedName(null)
  }

  const isDirty = form.formState.isDirty

  function handleCancelClick() {
    if (isDirty) {
      setDiscardOpen(true)
      return
    }
    router.push('/profile')
  }

  function confirmDiscard() {
    form.reset()
    setVerifiedName(null)
    setDiscardOpen(false)
    router.push('/profile')
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <button
        onClick={() => router.push('/profile')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <div>
        <h1 className="text-lg font-semibold">Payout Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Link your Nigerian bank account to receive your delivery fees.
        </p>
      </div>

      {loadingExisting ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : existingError ? (
        <Card>
          <CardContent className="p-4">
            <EmptyState
              icon={<AlertCircle className="h-6 w-6" />}
              title="Couldn't load your payout account"
              description="Check your connection and try again."
              action={{ label: 'Retry', onClick: () => refetchExisting() }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {existing?.has_payout_account ? (
            <div className="flex items-start gap-3 rounded-md border border-success/20 bg-success-muted p-4 text-sm">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <div>
                <p className="font-medium text-success">Payout account active</p>
                <p className="mt-1 text-foreground">
                  {existing.account_name} &mdash; {existing.bank_name}
                </p>
                <p className="text-muted-foreground">
                  Account: ****{existing.account_number?.slice(-4)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Fill the form below to replace it.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-warning/20 bg-warning-muted p-4 text-sm">
              <p className="font-medium text-warning">No payout account yet</p>
              <p className="mt-1 text-muted-foreground">
                Your delivery fees stay unpaid until a verified bank account is on file.
              </p>
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {existing?.has_payout_account ? 'Replace payout account' : 'Add payout account'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {banksError ? (
                <EmptyState
                  icon={<AlertCircle className="h-6 w-6" />}
                  title="Couldn't load banks"
                  description="Check your connection and try again."
                  action={{ label: 'Retry', onClick: () => refetchBanks() }}
                />
              ) : (
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
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={banksLoading}
                              {...field}
                              onChange={(e) => {
                                field.onChange(e)
                                onFieldChange()
                              }}
                            >
                              <option value="">
                                {banksLoading ? 'Loading banks…' : 'Select your bank…'}
                              </option>
                              {banks?.map((b) => (
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
                              inputMode="numeric"
                              maxLength={10}
                              {...field}
                              onChange={(e) => {
                                field.onChange(e.target.value.replace(/\D/g, '').slice(0, 10))
                                onFieldChange()
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {verifiedName && (
                      <div className="rounded-md border border-info/20 bg-info-muted px-4 py-3 text-sm">
                        <span className="text-muted-foreground">Account name: </span>
                        <span className="font-semibold text-info">{verifiedName}</span>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      We check the account name with your bank before saving. Money is only ever
                      sent to the name shown above.
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleVerify}
                        disabled={verify.isPending}
                      >
                        {verify.isPending ? 'Verifying…' : 'Verify Account'}
                      </Button>
                      <Button type="submit" disabled={!verifiedName || save.isPending}>
                        {save.isPending
                          ? 'Saving…'
                          : existing?.has_payout_account
                            ? 'Update Account'
                            : 'Save Account'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleCancelClick}
                        disabled={save.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard payout account changes?"
        description="You've started entering a payout account but haven't saved it. Discarding will clear what you've entered."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={confirmDiscard}
      />
    </div>
  )
}
