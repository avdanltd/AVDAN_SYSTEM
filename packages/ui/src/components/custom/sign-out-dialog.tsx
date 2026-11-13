'use client'

import { ConfirmDialog } from './confirm-dialog'

/** "Are you sure you want to sign out?" — every role's sign-out goes through this, never straight out. */
export function SignOutDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  loading?: boolean
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Sign out?"
      description="Are you sure you want to sign out?"
      confirmLabel="Yes, sign out"
      cancelLabel="No, stay signed in"
      destructive
      loading={loading}
      onConfirm={onConfirm}
    />
  )
}
