'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Badge,
  Switch,
  Skeleton,
  EmptyState,
  ConfirmDialog,
} from '@avdan/ui'
import { useCatalog } from '../hooks/use-catalog'
import { useToggleAvailability } from '../hooks/use-toggle-availability'
import { useDeleteProduct } from '../hooks/use-delete-product'
import { ProductForm } from './product-form'
import type { Product } from '../types'
import { formatPrice } from '@/lib/format'

function ProductCard({ product }: { product: Product }) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { mutate: toggleAvailability, isPending: toggling } = useToggleAvailability()
  const { mutate: deleteProduct, isPending: deleting } = useDeleteProduct()

  return (
    <>
      <Card className="flex flex-col">
        <CardContent className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{product.name}</p>
              {product.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {product.description}
                </p>
              )}
            </div>
            <Badge
              variant={product.available ? 'default' : 'secondary'}
              className={product.available ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
            >
              {product.available ? 'Available' : 'Unavailable'}
            </Badge>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="text-lg font-bold text-foreground">
              {formatPrice(product.price_kobo)}
            </span>
            <span className="text-sm text-muted-foreground">
              {product.stock_qty} in stock
            </span>
          </div>
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2 border-t border-border p-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={product.available}
              onCheckedChange={(checked) =>
                toggleAvailability({ id: product.id, available: checked })
              }
              disabled={toggling}
              aria-label={product.available ? 'Mark unavailable' : 'Mark available'}
            />
            <span className="text-xs text-muted-foreground">
              {product.available ? 'Available' : 'Unavailable'}
            </span>
          </div>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setEditOpen(true)}
              aria-label="Edit product"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
              aria-label="Delete product"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update the details for &quot;{product.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <ProductForm product={product} onSuccess={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Product"
        description={`Are you sure you want to delete "${product.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={() => deleteProduct(product.id, { onSuccess: () => setDeleteOpen(false) })}
      />
    </>
  )
}

function ProductSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-44 rounded-lg" />
      ))}
    </div>
  )
}

export function CatalogPage() {
  const [addOpen, setAddOpen] = useState(false)
  const { data, isLoading, error } = useCatalog()
  const products = data?.products ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${products.length} product${products.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      {isLoading && <ProductSkeletons />}

      {!isLoading && error && (
        <EmptyState
          title="Failed to load products"
          description="There was a problem loading your product catalog. Please refresh the page."
        />
      )}

      {!isLoading && !error && products.length === 0 && (
        <EmptyState
          title="No products yet"
          description="Add your first product to start receiving orders."
          action={{ label: 'Add Product', onClick: () => setAddOpen(true) }}
        />
      )}

      {!isLoading && products.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Add product dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>
              Fill in the details for your new product.
            </DialogDescription>
          </DialogHeader>
          <ProductForm onSuccess={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
