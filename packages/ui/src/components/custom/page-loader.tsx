import { Loader2 } from 'lucide-react'

import { cn } from '../../lib/utils'

interface PageLoaderProps {
  className?: string
  text?: string
}

export function PageLoader({ className, text }: PageLoaderProps) {
  return (
    <div
      className={cn(
        'flex h-full min-h-[300px] flex-col items-center justify-center gap-3',
        className,
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  )
}
