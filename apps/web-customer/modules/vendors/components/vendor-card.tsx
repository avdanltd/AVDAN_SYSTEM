'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { Card, Avatar, AvatarFallback, AvatarImage, Badge, Button, cn } from '@avdan/ui'
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
    <Link href={ROUTES.vendor(vendor.slug)} className="group block">
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        {/* Banner */}
        <div className="relative h-28 bg-gradient-to-br from-primary/20 via-primary/10 to-secondary">
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

        <div className="px-5 pb-4 pt-9">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {vendor.name}
            </h3>
            <Badge
              variant="secondary"
              className={cn(
                'shrink-0 text-xs',
                vendor.status === 'active' && 'bg-green-100 text-green-700',
              )}
            >
              {vendor.status === 'active' ? 'Open' : vendor.status}
            </Badge>
          </div>

          {vendor.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {vendor.description}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between">
            {vendor.rating !== null ? (
              <span className="flex items-center gap-1 text-sm font-medium text-amber-500">
                <Star className="h-3.5 w-3.5 fill-current" />
                {vendor.rating.toFixed(1)}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No ratings yet</span>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => e.preventDefault()}
              asChild
            >
              <Link href={ROUTES.vendor(vendor.slug)}>Visit Store</Link>
            </Button>
          </div>
        </div>
      </Card>
    </Link>
  )
}
