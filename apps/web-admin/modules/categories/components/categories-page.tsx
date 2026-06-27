'use client'

import { useState } from 'react'
import {
  Button,
  Badge,
  ConfirmDialog,
  DataTable,
  type Column,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  CategoryIcon,
} from '@avdan/ui'
import { Plus, MoreHorizontal, Pencil, PowerOff, Tag } from 'lucide-react'
import { useCategories, useDeactivateCategory } from '../hooks/use-categories'
import { CategoryDialog } from './category-dialog'
import type { Category } from '../types'

export function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories()
  const { mutate: deactivate } = useDeactivateCategory()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [deactivating, setDeactivating] = useState<Category | null>(null)

  const columns: Column<Category>[] = [
    {
      key: 'icon',
      header: 'Icon',
      cell: (cat) => (
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <CategoryIcon name={cat.icon} className="h-4 w-4" />
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      cell: (cat) => (
        <div>
          <p className="font-medium text-foreground">{cat.name}</p>
          {cat.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{cat.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      cell: (cat) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {cat.slug}
        </code>
      ),
    },
    {
      key: 'sort_order',
      header: 'Order',
      cell: (cat) => <span className="text-sm text-muted-foreground">{cat.sort_order}</span>,
    },
    {
      key: 'active',
      header: 'Status',
      cell: (cat) => (
        <Badge
          variant={cat.active ? 'default' : 'secondary'}
          className={cat.active ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
        >
          {cat.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'id',
      header: '',
      cell: (cat) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => { setEditing(cat); setDialogOpen(true) }}
              className="gap-2"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
            {cat.active && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeactivating(cat)}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <PowerOff className="h-3.5 w-3.5" /> Deactivate
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Tag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Categories</h1>
            <p className="text-sm text-muted-foreground">
              {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} — vendors assign these to products
            </p>
          </div>
        </div>
        <Button
          onClick={() => { setEditing(null); setDialogOpen(true) }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          New category
        </Button>
      </div>

      <DataTable
        data={categories}
        columns={columns}
        keyExtractor={(row) => row.id}
        loading={isLoading}
        emptyMessage="No categories yet. Create your first category so vendors can classify their products."
      />

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditing(null)
        }}
        editing={editing}
      />

      <ConfirmDialog
        open={!!deactivating}
        onOpenChange={(open) => { if (!open) setDeactivating(null) }}
        title={`Deactivate "${deactivating?.name}"?`}
        description="This category will no longer appear to vendors when creating products. Existing products keep their category assignment."
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => {
          if (deactivating) deactivate(deactivating.id)
          setDeactivating(null)
        }}
      />
    </div>
  )
}
