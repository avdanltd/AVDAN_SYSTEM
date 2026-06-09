'use client'

import Link from 'next/link'
import { Card, CardContent, Avatar, AvatarFallback, AvatarImage, Badge, cn } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import type { Vendor } from '../types'

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) {
    return <span className="text-xs text-muted-foreground">No ratings yet</span>
  }
  return (
    <span className="flex items-center gap-1 text-sm font-medium text-amber-500">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      {rating.toFixed(1)}
    </span>
  )
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function VendorCard({ vendor }: { vendor: Vendor }) {
  return (
    <Link href={ROUTES.vendor(vendor.slug)} className="group block">
      <Card
        className={cn(
          'overflow-hidden transition-all duration-200',
          'hover:shadow-md hover:-translate-y-0.5',
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 shrink-0 border border-border">
              {vendor.logo_url ? (
                <AvatarImage src={vendor.logo_url} alt={vendor.name} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                {getInitials(vendor.name)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {vendor.name}
              </h3>
              {vendor.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                  {vendor.description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <StarRating rating={vendor.rating} />
            <Badge
              variant={vendor.status === 'active' ? 'default' : 'secondary'}
              className={cn(
                vendor.status === 'active' && 'bg-green-100 text-green-700 hover:bg-green-100',
              )}
            >
              {vendor.status === 'active' ? 'Open' : vendor.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
