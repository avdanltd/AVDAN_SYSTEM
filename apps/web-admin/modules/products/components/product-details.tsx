'use client'

import { useState } from 'react'
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@avdan/ui'
import { useCategories } from '@/modules/categories/hooks/use-categories'
import { useReviewProduct } from '../hooks/use-review-product'
import type { AdminProduct } from '../types'

const NONE = '__none__'

/**
 * What an admin needs to judge a listing before approving it: every photo at a readable size, the
 * name and the vendor's own description word for word, and the category, which can be corrected
 * here at any time (a wrong category is the vendor's most common mistake).
 */
export function ProductDetails({ product }: { product: AdminProduct }) {
  const [active, setActive] = useState(0)
  const [category, setCategory] = useState(product.category_id ?? NONE)
  // What the server has now (this dialog holds a snapshot of the row, so track our own saves).
  const [saved, setSaved] = useState(product.category_id ?? NONE)
  const { setCategory: saveCategory } = useReviewProduct()
  const { data: categories } = useCategories()

  const images = product.image_urls
  const all = (categories ?? []).filter((c) => c.active)
  const byId = new Map(all.map((c) => [c.id, c]))
  const label = (id: string): string => {
    const c = byId.get(id)
    if (!c) return ''
    const parent = c.parent_id ? byId.get(c.parent_id) : undefined
    return parent ? `${parent.name} › ${c.name}` : c.name
  }
  const options = all.map((c) => ({ id: c.id, label: label(c.id) })).sort((a, b) => a.label.localeCompare(b.label))
  const changed = category !== saved

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {images.length > 0 ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[Math.min(active, images.length - 1)]}
              alt={product.name}
              className="max-h-72 w-full rounded-md border border-border bg-muted object-contain"
            />
            {images.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {images.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Show photo ${i + 1}`}
                    aria-pressed={i === active}
                    className={`overflow-hidden rounded-md border-2 ${i === active ? 'border-primary' : 'border-transparent'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-14 w-14 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="rounded-md bg-warning-muted p-3 text-sm text-foreground">This product has no photos.</p>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{product.name}</p>
        {product.description?.trim() ? (
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">
            {product.description}
          </p>
        ) : (
          <p className="text-sm text-warning">The vendor wrote no description.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Category</Label>
        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No category</SelectItem>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={!changed || saveCategory.isPending}
            onClick={() =>
              saveCategory.mutate(
                { id: product.id, categoryId: category === NONE ? null : category },
                { onSuccess: () => setSaved(category) },
              )
            }
          >
            {saveCategory.isPending ? 'Saving…' : 'Save category'}
          </Button>
        </div>
      </div>
    </div>
  )
}
