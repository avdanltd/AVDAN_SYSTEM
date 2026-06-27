'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
  Textarea,
  Button,
  Switch,
} from '@avdan/ui'
import { categoryCreateSchema, type CategoryCreateForm } from '../schemas/category.schemas'
import { useCreateCategory, useUpdateCategory } from '../hooks/use-categories'
import type { Category } from '../types'

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Category | null
}

export function CategoryDialog({ open, onOpenChange, editing }: CategoryDialogProps) {
  const { mutate: create, isPending: creating } = useCreateCategory()
  const { mutate: update, isPending: updating } = useUpdateCategory()
  const isPending = creating || updating

  const form = useForm<CategoryCreateForm>({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues: { name: '', description: '', icon: '', sort_order: 0 },
  })

  useEffect(() => {
    if (editing) {
      form.reset({
        name: editing.name,
        description: editing.description ?? '',
        icon: editing.icon ?? '',
        sort_order: editing.sort_order,
      })
    } else {
      form.reset({ name: '', description: '', icon: '', sort_order: 0 })
    }
  }, [editing, form])

  function handleSubmit(values: CategoryCreateForm) {
    const payload = {
      ...values,
      description: values.description || null,
      icon: values.icon || null,
    }

    if (editing) {
      update(
        { id: editing.id, data: payload },
        { onSuccess: () => { form.reset(); onOpenChange(false) } },
      )
    } else {
      create(payload, { onSuccess: () => { form.reset(); onOpenChange(false) } })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Category' : 'New Category'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update category details. Changes apply immediately to all vendors and products.'
              : 'Create a new product category that vendors can assign to their products.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Electronics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon name <span className="text-xs text-muted-foreground">(lucide icon slug)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. cpu, shopping-bag, heart" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-xs text-muted-foreground">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Short description shown to customers"
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sort_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sort order <span className="text-xs text-muted-foreground">(lower = appears first)</span></FormLabel>
                  <FormControl>
                    <Input type="number" min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (editing ? 'Saving…' : 'Creating…') : (editing ? 'Save changes' : 'Create category')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
