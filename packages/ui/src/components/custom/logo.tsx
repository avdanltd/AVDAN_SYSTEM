import { cn } from '../../lib/utils'

const SIZE_CLASSES = {
  sm: 'h-8 w-auto',
  md: 'h-10 w-auto',
  lg: 'h-14 w-auto',
  xl: 'h-20 w-auto',
} as const

interface LogoProps {
  size?: keyof typeof SIZE_CLASSES
  className?: string
  suffix?: string
  suffixClassName?: string
}

export function Logo({ size = 'md', className, suffix, suffixClassName }: LogoProps) {
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next-eslint/no-img-element */}
      <img
        src="/logo.png"
        alt="AVDAN"
        className={cn(SIZE_CLASSES[size], className)}
      />
      {suffix && (
        <span className={cn('font-semibold tracking-tight text-foreground', suffixClassName)}>
          {suffix}
        </span>
      )}
    </span>
  )
}
