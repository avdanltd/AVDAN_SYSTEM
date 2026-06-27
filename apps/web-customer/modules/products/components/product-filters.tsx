'use client'

import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import {
  Badge,
  Button,
  CategoryIcon,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Separator,
  Switch,
  Label,
} from '@avdan/ui'
import type { Category } from '@/modules/categories/types'

export interface FilterState {
  sort: string
  categoryId?: string
  minPrice: string
  maxPrice: string
  availableOnly: boolean
}

interface ProductFiltersProps {
  filters: FilterState
  categories?: Category[]
  showCategoryFilter?: boolean
  totalResults?: number
  onFilterChange: (patch: Partial<FilterState>) => void
  onReset: () => void
}

const SORT_OPTIONS = [
  { value: 'popular',    label: 'Popular' },
  { value: 'newest',     label: 'Newest' },
  { value: 'price_asc',  label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
] as const

function activeFilterCount(f: FilterState, showCategory: boolean): number {
  let n = 0
  if (showCategory && f.categoryId) n++
  if (f.minPrice) n++
  if (f.maxPrice) n++
  if (f.availableOnly) n++
  if (f.sort !== 'popular') n++
  return n
}

function PriceInputs({
  min, max,
  onChange,
}: { min: string; max: string; onChange: (min: string, max: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₦</span>
        <input
          type="number"
          min={0}
          placeholder="Min"
          value={min}
          onChange={(e) => onChange(e.target.value, max)}
          className="h-9 w-full rounded-md border border-input bg-background pl-6 pr-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <span className="text-muted-foreground">—</span>
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₦</span>
        <input
          type="number"
          min={0}
          placeholder="Max"
          value={max}
          onChange={(e) => onChange(min, e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background pl-6 pr-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  )
}

function FilterPanel({
  filters, categories, showCategoryFilter, onFilterChange,
}: Pick<ProductFiltersProps, 'filters' | 'categories' | 'showCategoryFilter' | 'onFilterChange'>) {
  return (
    <div className="space-y-5">
      {/* Sort */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sort by</p>
        <Select value={filters.sort} onValueChange={(v) => onFilterChange({ sort: v })}>
          <SelectTrigger className="h-9 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showCategoryFilter && categories && categories.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</p>
            <Select
              value={filters.categoryId ?? 'all'}
              onValueChange={(v) => onFilterChange({ categoryId: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <CategoryIcon name={cat.icon} className="h-3.5 w-3.5" />
                      {cat.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <Separator />

      {/* Price range */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price range</p>
        <PriceInputs
          min={filters.minPrice}
          max={filters.maxPrice}
          onChange={(min, max) => onFilterChange({ minPrice: min, maxPrice: max })}
        />
      </div>

      <Separator />

      {/* Availability */}
      <div className="flex items-center justify-between">
        <Label htmlFor="available-only" className="text-sm font-medium cursor-pointer">
          In stock only
        </Label>
        <Switch
          id="available-only"
          checked={filters.availableOnly}
          onCheckedChange={(v) => onFilterChange({ availableOnly: v })}
        />
      </div>
    </div>
  )
}

export function ProductFilters({
  filters, categories, showCategoryFilter = false,
  totalResults, onFilterChange, onReset,
}: ProductFiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const count = activeFilterCount(filters, showCategoryFilter)
  const selectedCategory = showCategoryFilter
    ? categories?.find((c) => c.id === filters.categoryId)
    : undefined

  function applyAndClose(patch: Partial<FilterState>) {
    onFilterChange(patch)
    setSheetOpen(false)
  }

  return (
    <div className="space-y-3">
      {/* ── Toolbar row ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Mobile: filter button → bottom sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="relative gap-2 sm:hidden">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {count}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-5 pb-8 pt-4">
            <SheetHeader className="mb-4 flex-row items-center justify-between">
              <SheetTitle className="text-base">Filters</SheetTitle>
              {count > 0 && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onReset}>
                  Reset all
                </Button>
              )}
            </SheetHeader>
            <FilterPanel
              filters={filters}
              categories={categories}
              showCategoryFilter={showCategoryFilter}
              onFilterChange={(patch) => applyAndClose(patch)}
            />
            <div className="mt-6">
              <Button className="w-full" onClick={() => setSheetOpen(false)}>
                {totalResults !== undefined ? `Show ${totalResults} results` : 'Apply'}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop: inline controls */}
        <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-2">
          <Select value={filters.sort} onValueChange={(v) => onFilterChange({ sort: v })}>
            <SelectTrigger className="h-9 w-40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showCategoryFilter && categories && categories.length > 0 && (
            <Select
              value={filters.categoryId ?? 'all'}
              onValueChange={(v) => onFilterChange({ categoryId: v === 'all' ? undefined : v })}
            >
              <SelectTrigger className="h-9 w-44 text-sm">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <CategoryIcon name={cat.icon} className="h-3.5 w-3.5" />
                      {cat.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <PriceInputs
            min={filters.minPrice}
            max={filters.maxPrice}
            onChange={(min, max) => onFilterChange({ minPrice: min, maxPrice: max })}
          />

          <div className="flex items-center gap-1.5">
            <Switch
              id="avail-desktop"
              checked={filters.availableOnly}
              onCheckedChange={(v) => onFilterChange({ availableOnly: v })}
            />
            <Label htmlFor="avail-desktop" className="cursor-pointer text-sm text-muted-foreground">
              In stock
            </Label>
          </div>

          {count > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={onReset}>
              <X className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>

        {totalResults !== undefined && (
          <span className="ml-auto text-sm text-muted-foreground">
            {totalResults} result{totalResults === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Active filter chips */}
      {count > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.sort !== 'popular' && (
            <FilterChip label={SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? filters.sort} onRemove={() => onFilterChange({ sort: 'popular' })} />
          )}
          {showCategoryFilter && selectedCategory && (
            <FilterChip label={selectedCategory.name} onRemove={() => onFilterChange({ categoryId: undefined })} />
          )}
          {filters.minPrice && (
            <FilterChip label={`Min ₦${filters.minPrice}`} onRemove={() => onFilterChange({ minPrice: '' })} />
          )}
          {filters.maxPrice && (
            <FilterChip label={`Max ₦${filters.maxPrice}`} onRemove={() => onFilterChange({ maxPrice: '' })} />
          )}
          {filters.availableOnly && (
            <FilterChip label="In stock only" onRemove={() => onFilterChange({ availableOnly: false })} />
          )}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1.5 pr-1.5 text-xs">
      {label}
      <button
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-secondary-foreground/10"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )
}
