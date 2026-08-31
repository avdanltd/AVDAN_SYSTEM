import * as React from 'react'
import { Card, CardContent } from '../ui/card'
import { cn } from '../../lib/utils'
import { Skeleton } from '../ui/skeleton'

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: { value: number; label: string }
  loading?: boolean
  className?: string
  valueClassName?: string
  /** 'accent' reserves the premium Signal-Orange icon treatment for the one standout stat per screen. */
  tone?: 'primary' | 'accent'
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  loading = false,
  className,
  valueClassName,
  tone = 'primary',
}: StatsCardProps) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="mt-2 h-8 w-24" />
            ) : (
              <p className={cn('mt-1 text-2xl font-bold text-foreground', valueClassName)}>
                {value}
              </p>
            )}
            {subtitle && !loading && (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && !loading && (
              <p
                className={cn(
                  'mt-1 text-xs font-medium',
                  trend.value >= 0 ? 'text-success' : 'text-destructive',
                )}
              >
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
              </p>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                'ml-4 shrink-0 rounded-full p-3',
                tone === 'accent' ? 'bg-brand-accent/10 text-brand-accent' : 'bg-primary/10 text-primary',
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
