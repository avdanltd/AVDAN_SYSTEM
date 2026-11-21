'use client'

import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Star } from 'lucide-react'
import { formatVendorLocation } from '@avdan/types'
import { Card, Avatar, AvatarFallback, AvatarImage, Badge, cn } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import type { Vendor } from '../types'

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
    <Link href={ROUTES.vendor(vendor.slug)} className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        {/* Banner */}
        <div className="relative h-28 shrink-0 bg-gradient-to-br from-primary/20 via-primary/10 to-secondary">
          {vendor.logo_url && (
            <Image
              src={vendor.logo_url}
              alt={vendor.name}
              fill
              className="object-cover opacity-30"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
          )}
          {/* Avatar overlapping banner */}
          <div className="absolute -bottom-7 left-5">
            <Avatar className="h-14 w-14 border-4 border-background shadow-md">
              {vendor.logo_url && <AvatarImage src={vendor.logo_url} alt={vendor.name} />}
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {getInitials(vendor.name)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="flex flex-1 flex-col px-5 pb-4 pt-9">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {vendor.name}
            </h3>
            <Badge
              variant="secondary"
              className={cn(
                'shrink-0 text-xs',
                vendor.status === 'active' && vendor.is_open !== false && 'bg-success-muted text-success',
                vendor.status === 'active' && vendor.is_open === false && 'bg-destructive/10 text-destructive',
              )}
            >
              {vendor.status !== 'active' ? vendor.status : vendor.is_open === false ? 'Closed' : 'Open'}
            </Badge>
          </div>
          {/* Location and description always take their space (even when empty) so every card in a
              row is the same height whatever the vendor typed. */}
          <p className="mt-0.5 flex min-h-4 items-center gap-1 text-xs text-muted-foreground">
            {formatVendorLocation(vendor.city, vendor.state) && (
              <>
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                <span className="line-clamp-1">
                  {formatVendorLocation(vendor.city, vendor.state)}
                  {vendor.distance_km != null ? ` · ${vendor.distance_km} km away` : ''}
                </span>
              </>
            )}
          </p>

          <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
            {vendor.description}
          </p>

          <div className="mt-auto flex items-center justify-between pt-3">
            {vendor.rating !== null && (vendor.review_count ?? 0) > 0 ? (
              <span className="flex items-center gap-1 text-sm font-medium text-warning">
                <Star className="h-3.5 w-3.5 fill-current" />
                {vendor.rating.toFixed(1)}
                <span className="text-xs font-normal text-muted-foreground">({vendor.review_count})</span>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No ratings yet</span>
            )}

            <span className="inline-flex h-7 items-center rounded-md border border-input px-3 text-xs font-medium text-foreground transition-colors group-hover:bg-accent">
              Visit Store
            </span>
          </div>
        </div>
      </Card>
    </Link>
  )
}
