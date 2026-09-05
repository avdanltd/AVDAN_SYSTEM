'use client'

import { useState } from 'react'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Skeleton,
} from '@avdan/ui'
import { Wifi, WifiOff } from 'lucide-react'
import { useAllRiders, useAssignRider } from '../hooks/use-dispatch'
import { formatKobo } from '@/lib/format'

interface AssignRiderDialogProps {
  orderId: string
  totalKobo: number
  onOpenChange: (open: boolean) => void
}

export function AssignRiderDialog({ orderId, totalKobo, onOpenChange }: AssignRiderDialogProps) {
  const { data: riders = [], isLoading } = useAllRiders()
  const { mutate: assign, isPending } = useAssignRider()
  const [selected, setSelected] = useState<string | null>(null)

  function handleAssign() {
    if (!selected) return
    assign(
      { orderId, riderId: selected },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Rider</DialogTitle>
          <DialogDescription>
            Select a rider for order{' '}
            <span className="font-mono">#{orderId.slice(0, 8)}</span>
            {' '}({formatKobo(totalKobo)})
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : riders.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No riders in the system. Create a rider account from the Users page.
          </p>
        ) : (
          <ul className="space-y-2 py-1 max-h-72 overflow-y-auto">
            {riders.map((rider) => {
              const isSelected = selected === rider.id
              return (
                <li key={rider.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(rider.id)}
                    className={`w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {rider.online ? (
                        <Wifi className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <WifiOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selected || isPending}>
            {isPending ? 'Assigning…' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
