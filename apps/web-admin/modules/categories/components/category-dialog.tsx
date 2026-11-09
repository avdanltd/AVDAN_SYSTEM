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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@avdan/ui'
import { categoryCreateSchema, type CategoryCreateForm } from '../schemas/category.schemas'
import { useCategories, useCreateCategory, useUpdateCategory } from '../hooks/use-categories'
import type { Category } from '../types'

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Category | null
  /** Pre-select this parent when creating (the "Add sub-category" action). */
  defaultParentId?: string | null
}

export function CategoryDialog({ open, onOpenChange, editing, defaultParentId }: CategoryDialogProps) {
  const { data: all = [] } = useCategories()
  // Only top-level categories can be parents (one level of nesting), and a category that already
  // has sub-categories can't itself become one.
  const hasChildren = !!editing && all.some((c) => c.parent_id === editing.id)
  const parents = all.filter((c) => !c.parent_id && c.id !== editing?.id)
  const { mutate: create, isPending: creating } = useCreateCategory()
  const { mutate: update, isPending: updating } = useUpdateCategory()
  const isPending = creating || updating

  const form = useForm<CategoryCreateForm>({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues: { name: '', description: '', icon: '', parent_id: 'none', sort_order: 0 },
  })

  useEffect(() => {
    if (editing) {
      form.reset({
        name: editing.name,
        description: editing.description ?? '',
        icon: editing.icon ?? '',
        parent_id: editing.parent_id ?? 'none',
        sort_order: editing.sort_order,
      })
    } else {
      form.reset({ name: '', description: '', icon: '', parent_id: defaultParentId ?? 'none', sort_order: 0 })
    }
  }, [editing, defaultParentId, open, form])

  function handleSubmit(values: CategoryCreateForm) {
    const { parent_id, ...rest } = values
    const payload = {
      ...rest,
      description: values.description || null,
      icon: values.icon || null,
    }

    if (editing) {
      update(
        { id: editing.id, data: { ...payload, parent_id: parent_id === 'none' ? '' : parent_id } },
        { onSuccess: () => { form.reset(); onOpenChange(false) } },
      )
    } else {
      create({ ...payload, parent_id: parent_id === 'none' ? null : parent_id }, { onSuccess: () => { form.reset(); onOpenChange(false) } })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Category' : defaultParentId ? 'New Sub-category' : 'New Category'}</DialogTitle>
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
              name="parent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent category <span className="text-xs text-muted-foreground">(makes this a sub-category)</span></FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={hasChildren}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="None (top-level)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None (top-level category)</SelectItem>
                      {parents.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasChildren && (
                    <p className="text-xs text-muted-foreground">
                      This category has sub-categories, so it can&apos;t be placed under another one.
                    </p>
                  )}
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
