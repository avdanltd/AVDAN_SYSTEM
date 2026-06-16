'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Switch,
  Textarea,
  Label,
} from '@avdan/ui'
import type { Product } from '../types'
import { useCreateProduct } from '../hooks/use-create-product'
import { useUpdateProduct } from '../hooks/use-update-product'

const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  price_kobo: z
    .number({ invalid_type_error: 'Price is required' })
    .min(100, 'Minimum price is ₦1'),
  stock_qty: z
    .number({ invalid_type_error: 'Stock quantity is required' })
    .int('Must be a whole number')
    .min(0, 'Cannot be negative'),
  available: z.boolean().default(true),
})

type ProductFormValues = z.infer<typeof productSchema>

interface ProductFormProps {
  product?: Product
  onSuccess?: () => void
}

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const isEditing = Boolean(product)
  const { mutate: createProduct, isPending: creating } = useCreateProduct()
  const { mutate: updateProduct, isPending: updating } = useUpdateProduct()
  const isPending = creating || updating

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      price_kobo: product?.price_kobo ?? 0,
      stock_qty: product?.stock_qty ?? 0,
      available: product?.available ?? true,
    },
  })

  // Sync form when product changes (edit dialog reopened with different product)
  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        description: product.description ?? '',
        price_kobo: product.price_kobo,
        stock_qty: product.stock_qty,
        available: product.available,
      })
    }
  }, [product, form])

  function onSubmit(values: ProductFormValues) {
    const payload = {
      name: values.name,
      description: values.description || undefined,
      price_kobo: values.price_kobo,
      stock_qty: values.stock_qty,
      available: values.available,
    }

    if (isEditing && product) {
      updateProduct(
        { id: product.id, data: payload },
        { onSuccess: () => { form.reset(); onSuccess?.() } },
      )
    } else {
      createProduct(payload, {
        onSuccess: () => { form.reset(); onSuccess?.() },
      })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Jollof Rice (Large)" {...field} />
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
              <FormLabel>Description (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the product…"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price_kobo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price (kobo)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="e.g. 250000 for ₦2,500"
                    {...field}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
                {field.value > 0 && (
                  <p className="text-xs text-muted-foreground">
                    = ₦{(field.value / 100).toLocaleString('en-NG')}
                  </p>
                )}
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stock_qty"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock Qty</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0"
                    {...field}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="available"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-3">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    id="available-switch"
                  />
                </FormControl>
                <Label htmlFor="available-switch" className="cursor-pointer">
                  Available for purchase
                </Label>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={isPending}>
            {isPending
              ? isEditing ? 'Saving…' : 'Creating…'
              : isEditing ? 'Save Changes' : 'Add Product'
            }
          </Button>
        </div>
      </form>
    </Form>
  )
}
