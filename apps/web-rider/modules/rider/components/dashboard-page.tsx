'use client'

import Link from 'next/link'
import { useState } from 'react'
import { MapPin, Package, ChevronRight, Wifi, WifiOff } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Switch, Spinner } from '@avdan/ui'

import { useAvailability } from '../hooks/use-availability'
import { useRiderOrders } from '../hooks/use-rider-orders'
import { useLocationBroadcast } from '../hooks/use-location-broadcast'
import { useSession } from '@/modules/auth/hooks/use-session'
import { ROUTES } from '@/config/routes'
import { formatKobo } from '@/lib/format'
import { ORDER_ACTIONS } from '../types'

const ACTIVE_STATUSES = new Set(['READY_FOR_PICKUP', 'PICKED_UP', 'QA_PASSED', 'OUT_FOR_DELIVERY'])

export function DashboardPage() {
  const { user } = useSession()
  const [isOnline, setIsOnline] = useState(false)
  const { mutate: toggleAvailability, isPending: isToggling } = useAvailability()
  const { data: orders, isLoading } = useRiderOrders()

  useLocationBroadcast(isOnline)

  const activeOrders = orders?.filter((o) => ACTIVE_STATUSES.has(o.status)) ?? []
  const activeOrder = activeOrders[0]

  const handleToggle = (value: boolean) => {
    setIsOnline(value)
    toggleAvailability(value)
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      {/* Online toggle */}
      <Card className={isOnline ? 'border-green-500 bg-green-50' : 'border-border'}>
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            {isOnline ? (
              <Wifi className="h-6 w-6 text-green-600" />
            ) : (
              <WifiOff className="h-6 w-6 text-muted-foreground" />
            )}
            <div>
              <p className="text-base font-semibold">{isOnline ? 'You are Online' : 'You are Offline'}</p>
              <p className="text-sm text-muted-foreground">
                {isOnline ? 'GPS broadcasting active' : 'Toggle to start receiving orders'}
              </p>
            </div>
          </div>
          {isToggling ? (
            <Spinner size="sm" />
          ) : (
            <Switch checked={isOnline} onCheckedChange={handleToggle} aria-label="Go online" />
          )}
        </CardContent>
      </Card>

      {/* Active order */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center p-10">
            <Spinner />
          </CardContent>
        </Card>
      ) : activeOrder ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Active Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {activeOrder.delivery_address.street ?? 'Delivery address'}
                {activeOrder.delivery_address.city ? `, ${activeOrder.delivery_address.city}` : ''}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="capitalize">{activeOrder.status.replace(/_/g, ' ')}</Badge>
              <span className="text-sm font-medium">{formatKobo(activeOrder.total_kobo)}</span>
            </div>
            {ORDER_ACTIONS[activeOrder.status] && (
              <Link href={ROUTES.order(activeOrder.id)}>
                <Button className="w-full" size="lg">
                  Take Action <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
            <Package className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No active orders</p>
            <p className="text-xs text-muted-foreground">
              {isOnline ? 'Waiting for assignment…' : 'Go online to receive orders'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Quick link */}
      <Link href={ROUTES.orders}>
        <Button variant="outline" className="w-full">
          View all orders ({orders?.length ?? 0})
        </Button>
      </Link>

      {user && (
        <p className="text-center text-xs text-muted-foreground">
          Logged in as <span className="font-medium">{user.name ?? user.email}</span>
        </p>
      )}
    </div>
  )
}
