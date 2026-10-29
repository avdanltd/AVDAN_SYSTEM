import { cn } from '@avdan/ui'

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
}

export function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <div className={cn('mx-auto w-full max-w-8xl px-4 py-6 sm:px-6', className)}>{children}</div>
  )
}
