import * as React from 'react'

import { cn } from '../../lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumb?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

function PageHeader({ title, description, breadcrumb, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 pb-6', className)}>
      <div className="flex flex-col gap-1">
        {breadcrumb && <div className="text-sm text-muted-foreground">{breadcrumb}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export { PageHeader }
