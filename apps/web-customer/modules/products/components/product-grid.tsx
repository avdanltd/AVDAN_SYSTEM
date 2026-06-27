import { EmptyState } from '@avdan/ui'
import { ShoppingBag } from 'lucide-react'
import { ProductCard } from './product-card'
import { ProductCardSkeleton } from './product-card-skeleton'
import type { ProductListing } from '../types'

interface ProductGridProps {
  products: ProductListing[] | undefined
  loading?: boolean
  error?: Error | null
  emptyTitle?: string
  emptyDescription?: string
  skeletonCount?: number
}

export function ProductGrid({
  products,
  loading,
  error,
  emptyTitle = 'No products found',
  emptyDescription = 'Try adjusting your filters or search terms.',
  skeletonCount = 8,
}: ProductGridProps) {
  if (error) {
    return (
      <EmptyState
        icon={<ShoppingBag className="h-10 w-10" />}
        title="Failed to load products"
        description="Something went wrong. Please try again."
      />
    )
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!products || products.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag className="h-10 w-10" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )
}
