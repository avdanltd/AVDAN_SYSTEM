'use client'

import { Star } from 'lucide-react'

import { cn } from '../../lib/utils'

interface StarRatingProps {
  /** 0–5; fractions are rounded to the nearest half-star-free display (filled up to the value). */
  value: number
  /** Present = interactive (a radio group of 1–5 stars). Absent = read-only display. */
  onChange?: (rating: number) => void
  size?: number
  className?: string
  /** Names the control for assistive tech when interactive, e.g. "Rate Power Oil". */
  label?: string
}

/** Five stars. Read-only by default; pass `onChange` to let someone choose a rating. */
export function StarRating({ value, onChange, size = 16, className, label }: StarRatingProps) {
  const rounded = Math.round(value)
  const stars = [1, 2, 3, 4, 5].map((n) => {
    const filled = n <= rounded
    const icon = (
      <Star
        width={size}
        height={size}
        className={cn(filled ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')}
        aria-hidden="true"
      />
    )
    return onChange ? (
      <button
        key={n}
        type="button"
        role="radio"
        aria-checked={n === rounded}
        aria-label={`${n} star${n > 1 ? 's' : ''}`}
        onClick={() => onChange(n)}
        className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {icon}
      </button>
    ) : (
      <span key={n}>{icon}</span>
    )
  })

  return onChange ? (
    <div role="radiogroup" aria-label={label ?? 'Rating'} className={cn('inline-flex items-center', className)}>
      {stars}
    </div>
  ) : (
    <div
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {stars}
    </div>
  )
}
