'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Column,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@avdan/ui'
import { MoreHorizontal, Plus, Pencil, Trash2, Building2 } from 'lucide-react'
import { useHubs, useCreateHub } from '@/modules/users/hooks/use-hubs'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import type { Hub } from '@/modules/users/types'

const hubSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  capacity: z.coerce.number().int().min(1).default(100),
})

type HubFormValues = z.infer<typeof hubSchema>

function useUpdateHub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: HubFormValues }) =>
      apiClient.patch<Hub>(`/admin/hubs/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'hubs'] })
      toast.success('Hub updated')
    },
    onError: () => toast.error('Failed to update hub'),
  })
}

function useDeleteHub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/admin/hubs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'hubs'] })
      toast.success('Hub deleted')
    },
    onError: () => toast.error('Failed to delete hub'),
  })
}

function EditHubDialog({ hub, onOpenChange }: { hub: Hub; onOpenChange: (o: boolean) => void }) {
  const { mutate, isPending } = useUpdateHub()
  const form = useForm<HubFormValues>({
    resolver: zodResolver(hubSchema),
    defaultValues: { name: hub.name, capacity: hub.capacity },
  })

  function handleSubmit(values: HubFormValues) {
    mutate({ id: hub.id, data: values }, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Hub</DialogTitle>
          <DialogDescription>Update hub details.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hub Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max concurrent orders</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    How many orders this hub can handle at the same time.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function HubsPage() {
  const { data: hubs = [], isLoading } = useHubs()
  const { mutate: createHub, isPending: creating } = useCreateHub()
  const { mutate: deleteHub, isPending: deleting } = useDeleteHub()

  const [createOpen, setCreateOpen] = useState(false)
  const [editHub, setEditHub] = useState<Hub | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Hub | null>(null)

  const createForm = useForm<HubFormValues>({
    resolver: zodResolver(hubSchema),
    defaultValues: { name: '', capacity: 100 },
  })

  function handleCreate(values: HubFormValues) {
    createHub(values, { onSuccess: () => { createForm.reset(); setCreateOpen(false) } })
  }

  const columns: Column<Hub>[] = [
    {
      key: 'name',
      header: 'Hub Name',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'Max Orders',
      cell: (row) => <span className="text-sm">{row.capacity}</span>,
    },
    {
      key: 'active',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.active ? 'default' : 'secondary'}>
          {row.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'id',
      header: 'ID',
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.id.slice(0, 8)}…</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => setEditHub(row)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteTarget(row)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Hubs</h1>
          <p className="text-sm text-muted-foreground">{hubs.length} hub{hubs.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Hub
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-background shadow-card">
        <DataTable
          columns={columns}
          data={hubs}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          emptyMessage="No hubs yet. Create one to assign agents."
        />
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Hub</DialogTitle>
            <DialogDescription>Add a new agent hub location.</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="flex flex-col gap-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hub Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Lagos Island Hub" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max concurrent orders</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      How many orders this hub can handle at the same time. Default: 100.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Hub'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      {editHub && (
        <EditHubDialog hub={editHub} onOpenChange={(o) => !o && setEditHub(null)} />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          title="Delete Hub"
          description={`Delete "${deleteTarget.name}"? Agents assigned to this hub will be unassigned. This cannot be undone.`}
          confirmLabel="Delete"
          destructive
          loading={deleting}
          onConfirm={() => deleteHub(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
        />
      )}
    </div>
  )
}
