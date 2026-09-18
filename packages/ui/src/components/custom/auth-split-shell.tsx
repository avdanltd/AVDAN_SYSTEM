import * as React from 'react'

import { cn } from '../../lib/utils'

interface TrustBadge {
  value: string
  label: string
}

interface AuthSplitShellProps {
  /** Hero photo for the brand panel — each app supplies its own (see STATUS_DESIGN.md §6). */
  imageSrc: string
  imageAlt: string
  /** Icon-only badge mark (no wordmark) — the navy wordmark text is unreadable over a dark photo
   * overlay, so the panel uses the badge alone; the full lockup (via `Logo`) belongs in the form
   * panel instead, where the light background gives the wordmark its contrast back. */
  badgeSrc: string
  tagline: string
  badges?: TrustBadge[]
  children: React.ReactNode
  contentClassName?: string
}

/**
 * The premium auth split-shell: a dark, photo-led brand panel next to the functional form —
 * shared across every app's login/register screens for one consistent flagship moment instead
 * of a bare centered card (see STATUS_DESIGN.md §0, §6 Phase B).
 *
 * Desktop: two columns, brand panel fixed left. Mobile: the same panel compresses to a short top
 * band with the form rising over it on a rounded sheet, so phones get the same warmth instead of
 * degrading to a plain form (pattern proven in the fondlyheld reference cited in STATUS_DESIGN.md).
 */
export function AuthSplitShell({
  imageSrc,
  imageAlt,
  badgeSrc,
  tagline,
  badges,
  children,
  contentClassName,
}: AuthSplitShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:grid lg:grid-cols-2">
      {/* Brand panel — mobile: short top band. Desktop: full-height left column. */}
      <div className="relative h-64 shrink-0 overflow-hidden lg:h-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={imageAlt}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Navy brand overlay for text legibility + an orange glow echoing the logo mark. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,18,41,0.55) 0%, rgba(10,18,41,0.75) 60%, rgba(10,18,41,0.92) 100%)',
          }}
        />
        <div
          aria-hidden
          className="avdan-animate-glow-pulse pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245,159,10,0.45), transparent 70%)' }}
        />
        <div
          aria-hidden
          className="avdan-animate-float-slow pointer-events-none absolute bottom-10 left-10 h-24 w-24 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(19,91,236,0.8), transparent 70%)' }}
        />

        {/* Content over the photo */}
        <div className="relative flex h-full flex-col justify-between p-6 lg:p-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeSrc} alt="AVDAN" className="h-10 w-10 drop-shadow-lg lg:h-12 lg:w-12" />

          <div className="avdan-animate-fade-up hidden lg:block">
            <p className="max-w-sm font-display text-3xl leading-snug text-white">{tagline}</p>
            {badges && badges.length > 0 && (
              <div className="mt-8 flex gap-6">
                {badges.map((b) => (
                  <div key={b.label}>
                    <p className="font-display text-2xl text-white">{b.value}</p>
                    <p className="text-xs text-white/70">{b.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compact tagline for the mobile band — no badges, no room. */}
          <p className="avdan-animate-fade-up mx-auto max-w-[20rem] text-center text-sm font-medium leading-snug text-white lg:hidden">
            {tagline}
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative z-10 -mt-6 flex flex-1 items-start justify-center rounded-t-[28px] bg-background px-6 pb-14 pt-10 shadow-[0_-16px_32px_-16px_rgba(0,0,0,0.15)] lg:mt-0 lg:items-center lg:rounded-none lg:py-16 lg:shadow-none">
        <div className={cn('avdan-animate-fade-up w-full max-w-sm', contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  )
}
