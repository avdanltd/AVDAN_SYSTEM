'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  toast,
} from '@avdan/ui'
import { authService } from '@/modules/auth/services/auth.service'
import { useAuthStore } from '@/modules/auth/store/auth.store'

/** Delete (anonymise) the signed-in customer's account. Refused by the server while an order is in progress. */
export function DeleteAccountCard() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const clearUser = useAuthStore((s) => s.clearUser)
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')

  const { mutate, isPending, error, reset } = useMutation({
    mutationFn: () => authService.deleteAccount(password),
    onSuccess: () => {
      toast.success('Your account has been deleted.')
      clearUser()
      queryClient.clear()
      router.push('/')
    },
  })

  function close() {
    setOpen(false)
    setPassword('')
    reset()
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base text-destructive">Delete account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          This removes your name, email and phone number and signs you out for good. It can&apos;t be undone. Order and payment records are kept as
          the law requires, without your personal details.{' '}
          <Link href="/delete-account" className="text-primary underline">
            Read what is removed and kept
          </Link>
          .
        </p>
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </CardContent>

      {open && (
        <Dialog open onOpenChange={(o) => !o && close()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>Enter your password to confirm. This can&apos;t be undone.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="del-pw">Password</Label>
              <Input id="del-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {error && <p className="text-sm text-destructive">{error.message}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={isPending}>
                Keep my account
              </Button>
              <Button variant="destructive" disabled={!password || isPending} onClick={() => mutate()}>
                {isPending ? 'Deleting…' : 'Delete permanently'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  )
}
