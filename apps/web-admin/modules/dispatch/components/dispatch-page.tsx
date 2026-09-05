'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  OrderStatusBadge,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@avdan/ui'
import { Bike, CheckCircle2, MapPin, RefreshCw, Truck, Users, Wifi, WifiOff } from 'lucide-react'
import {
  useAllRiders,
  useAtHubOrders,
  useAvailableRiders,
  useDeliveredOrders,
  useInTransitOrders,
  useOutForDeliveryOrders,
  usePickedUpOrders,
  useReadyOrders,
} from '../hooks/use-dispatch'
import { AssignRiderDialog } from './assign-rider-dialog'
import { formatKobo, formatRelativeTime } from '@/lib/format'
import { Pagination } from '@/modules/shared/components/pagination'
import type { AvailableRider, DispatchOrder } from '../types'

function RidersBadge() {
  const { data: riders, isLoading } = useAvailableRiders()
  const count = riders?.length ?? 0
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
      <Users className="h-4 w-4 text-muted-foreground" />
      {isLoading ? (
        <Skeleton className="h-4 w-16" />
      ) : (
        <span className="text-sm">
          <span className={count > 0 ? 'font-semibold text-green-600' : 'font-semibold text-destructive'}>
            {count}
          </span>
          <span className="ml-1 text-muted-foreground">rider{count !== 1 ? 's' : ''} online</span>
        </span>
      )}
    </div>
  )
}

function OrderRow({ order, showAssign }: { order: DispatchOrder; showAssign: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8)}</span>
            <OrderStatusBadge status={order.status} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium">{formatKobo(order.total_kobo)}</span>
            <span className="text-muted-foreground">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {order.delivery_address?.city ?? '—'}
            </span>
            <span className="text-muted-foreground">{formatRelativeTime(order.updated_at)}</span>
          </div>
        </div>
        {showAssign && (
          order.rider_id ? (
            <span className="ml-4 flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Rider assigned
            </span>
          ) : (
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="ml-4 shrink-0"
            >
              <Bike className="mr-1.5 h-3.5 w-3.5" />
              Assign Rider
            </Button>
          )
        )}
      </div>

      {dialogOpen && (
        <AssignRiderDialog
          orderId={order.id}
          totalKobo={order.total_kobo}
          onOpenChange={(o) => !o && setDialogOpen(false)}
        />
      )}
    </>
  )
}

function OrderList({
  orders,
  isLoading,
  showAssign,
  page,
  total,
  pageSize,
  onPage,
}: {
  orders: DispatchOrder[]
  isLoading: boolean
  showAssign: boolean
  page: number
  total: number
  pageSize: number
  onPage: (p: number) => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Truck className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No orders in this queue</p>
      </div>
    )
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {orders.map((order) => (
          <OrderRow key={order.id} order={order} showAssign={showAssign} />
        ))}
      </div>
      {totalPages > 1 && (
        <Pagination page={page} pages={totalPages} total={total} onPageChange={onPage} />
      )}
    </div>
  )
}

function AllRidersList() {
  const { data: riders, isLoading } = useAllRiders()

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">All Riders</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !riders?.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No riders yet. Create a rider account from Users.
          </p>
        ) : (
          <ul className="space-y-2">
            {riders.map((rider: AvailableRider) => (
              <li
                key={rider.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  {rider.online ? (
                    <Wifi className="h-3 w-3 text-green-500" />
                  ) : (
                    <WifiOff className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {rider.name ?? `Rider ${rider.id.slice(0, 8)}`}
                  </span>
                  {rider.vehicle_type && (
                    <Badge variant="secondary" className="text-xs">
                      {rider.vehicle_type}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {rider.lat != null
                    ? `${Number(rider.lat).toFixed(4)}, ${Number(rider.lng).toFixed(4)}`
                    : 'No GPS'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function DispatchPage() {
  const queryClient = useQueryClient()
  const [readyPage, setReadyPage] = useState(1)
  const [pickedPage, setPickedPage] = useState(1)
  const [transitPage, setTransitPage] = useState(1)
  const [atHubPage, setAtHubPage] = useState(1)
  const [outPage, setOutPage] = useState(1)
  const [deliveredPage, setDeliveredPage] = useState(1)

  const { data: readyData, isLoading: loadingReady } = useReadyOrders(readyPage)
  const { data: pickedData, isLoading: loadingPicked } = usePickedUpOrders(pickedPage)
  const { data: transitData, isLoading: loadingTransit } = useInTransitOrders(transitPage)
  const { data: atHubData, isLoading: loadingAtHub } = useAtHubOrders(atHubPage)
  const { data: outData, isLoading: loadingOut } = useOutForDeliveryOrders(outPage)
  const { data: deliveredData, isLoading: loadingDelivered } = useDeliveredOrders(deliveredPage)

  function handleRefresh() {
    void queryClient.invalidateQueries({ queryKey: ['dispatch-ready'] })
    void queryClient.invalidateQueries({ queryKey: ['dispatch-picked-up'] })
    void queryClient.invalidateQueries({ queryKey: ['dispatch-in-transit'] })
    void queryClient.invalidateQueries({ queryKey: ['dispatch-at-hub'] })
    void queryClient.invalidateQueries({ queryKey: ['dispatch-out-for-delivery'] })
    void queryClient.invalidateQueries({ queryKey: ['dispatch-delivered'] })
    void queryClient.invalidateQueries({ queryKey: ['dispatch-riders'] })
    void queryClient.invalidateQueries({ queryKey: ['dispatch-all-riders'] })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Dispatch</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Assign riders to ready orders and monitor active deliveries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RidersBadge />
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="ready">
            <TabsList className="mb-4">
              <TabsTrigger value="ready">
                Ready for Pickup
                {(readyData?.total ?? 0) > 0 && (
                  <Badge variant="destructive" className="ml-2 text-xs">
                    {readyData!.total}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="picked">
                Picked Up
                {(pickedData?.total ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {pickedData!.total}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="transit">
                To Hub
                {(transitData?.total ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {transitData!.total}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="at-hub">
                At Hub / QA
                {(atHubData?.total ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {atHubData!.total}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="out-for-delivery">
                Out for Delivery
                {(outData?.total ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {outData!.total}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="delivered">
                Delivered
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ready">
              <OrderList
                orders={readyData?.items ?? []}
                isLoading={loadingReady}
                showAssign={true}
                page={readyPage}
                total={readyData?.total ?? 0}
                pageSize={readyData?.page_size ?? 20}
                onPage={setReadyPage}
              />
            </TabsContent>

            <TabsContent value="picked">
              <OrderList
                orders={pickedData?.items ?? []}
                isLoading={loadingPicked}
                showAssign={false}
                page={pickedPage}
                total={pickedData?.total ?? 0}
                pageSize={pickedData?.page_size ?? 20}
                onPage={setPickedPage}
              />
            </TabsContent>

            <TabsContent value="transit">
              <OrderList
                orders={transitData?.items ?? []}
                isLoading={loadingTransit}
                showAssign={false}
                page={transitPage}
                total={transitData?.total ?? 0}
                pageSize={transitData?.page_size ?? 20}
                onPage={setTransitPage}
              />
            </TabsContent>

            <TabsContent value="at-hub">
              <OrderList
                orders={atHubData?.items ?? []}
                isLoading={loadingAtHub}
                showAssign={false}
                page={atHubPage}
                total={atHubData?.total ?? 0}
                pageSize={atHubData?.page_size ?? 20}
                onPage={setAtHubPage}
              />
            </TabsContent>

            <TabsContent value="out-for-delivery">
              <OrderList
                orders={outData?.items ?? []}
                isLoading={loadingOut}
                showAssign={false}
                page={outPage}
                total={outData?.total ?? 0}
                pageSize={outData?.page_size ?? 20}
                onPage={setOutPage}
              />
            </TabsContent>

            <TabsContent value="delivered">
              <OrderList
                orders={deliveredData?.items ?? []}
                isLoading={loadingDelivered}
                showAssign={false}
                page={deliveredPage}
                total={deliveredData?.total ?? 0}
                pageSize={deliveredData?.page_size ?? 20}
                onPage={setDeliveredPage}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <AllRidersList />
        </div>
      </div>
    </div>
  )
}
