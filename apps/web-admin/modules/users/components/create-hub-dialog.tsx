'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Button,
} from '@avdan/ui'
import { useCreateHub } from '../hooks/use-hubs'

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  capacity: z.coerce.number().int().min(1).default(100),
})

type FormValues = z.infer<typeof schema>

interface CreateHubDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateHubDialog({ open, onOpenChange }: CreateHubDialogProps) {
  const { mutate, isPending } = useCreateHub()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', capacity: 100 },
  })

  function handleSubmit(values: FormValues) {
    mutate(values, {
      onSuccess: () => {
        form.reset()
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Hub</DialogTitle>
          <DialogDescription>Add a new agent hub location.</DialogDescription>
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
                    <Input placeholder="e.g. Lagos Island Hub" {...field} />
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
                    How many orders this hub can handle at the same time. Default: 100.
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
                {isPending ? 'Creating…' : 'Create Hub'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
