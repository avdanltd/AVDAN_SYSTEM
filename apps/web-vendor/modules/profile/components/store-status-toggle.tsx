'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { cn, toast } from '@avdan/ui'
import { profileService, type VendorMeResponse } from '../services/profile.service'

/**
 * The vendor's own store on/off switch, always visible in the top bar. When the store is closed
 * customers can still browse it but cannot place orders, so the closed state blinks red — a
 * vendor who forgot to reopen should notice at a glance. Open is a calm, steadily pulsing green.
 * (Reduced-motion users get a static dot; the text still says which state it is.)
 */
export function StoreStatusToggle() {
  const queryClient = useQueryClient()

  // Same key the payout nudge and profile page use — one fetch for all three.
  const { data: vendor } = useQuery({
    queryKey: ['vendor-catalog'],
    queryFn: profileService.getVendorProfile,
  })

  const toggle = useMutation({
    mutationFn: (isOpen: boolean) => profileService.setStoreOpen(isOpen),
    onSuccess: (updated) => {
      queryClient.setQueryData<VendorMeResponse>(['vendor-catalog'], (old) =>
        old ? { ...old, is_open: updated.is_open } : old,
      )
      toast.success(
        updated.is_open
          ? 'Your store is open — customers can order.'
          : 'Your store is closed — no new orders.',
      )
    },
    onError: () => toast.error('Could not change your store status. Please try again.'),
  })

  if (!vendor) return null
  const open = vendor.is_open

  return (
    <button
      type="button"
      onClick={() => toggle.mutate(!open)}
      disabled={toggle.isPending}
      aria-pressed={open}
      aria-label={open ? 'Store is open. Click to close it.' : 'Store is closed. Click to open it.'}
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60',
        open
          ? 'border-success/30 bg-success-muted text-success hover:bg-success/15'
          : 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-2.5 w-2.5 rounded-full',
          open ? 'animate-pulse bg-success' : 'avdan-animate-blink bg-destructive',
        )}
      />
      <span className="hidden sm:inline">{open ? 'Store open' : 'Store closed — tap to open'}</span>
      <span className="sm:hidden">{open ? 'Open' : 'Closed'}</span>
    </button>
  )
}
