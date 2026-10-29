'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@avdan/ui'
import { useHubs } from '../hooks/use-hubs'
import { useAssignHub } from '../hooks/use-hubs'
import type { AdminUser } from '../types'

interface AssignHubDialogProps {
  user: AdminUser
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AssignHubDialog({ user, open, onOpenChange }: AssignHubDialogProps) {
  const { data: hubs = [], isLoading } = useHubs()
  const { mutate, isPending } = useAssignHub()
  const [selectedHub, setSelectedHub] = useState<string>('__none__')

  function handleSave() {
    mutate(
      { userId: user.id, hubId: selectedHub === '__none__' ? null : selectedHub },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Hub</DialogTitle>
          <DialogDescription>
            Assign <strong>{user.name ?? user.email}</strong> to an agent hub. They will only see inbound orders for that hub.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading hubs…</p>
        ) : hubs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No hubs exist yet. Create a hub first from the Hubs section.
          </p>
        ) : (
          <Select value={selectedHub} onValueChange={setSelectedHub}>
            <SelectTrigger>
              <SelectValue placeholder="Select a hub" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Unassign —</SelectItem>
              {hubs.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name} ({h.capacity} capacity)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || hubs.length === 0}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
