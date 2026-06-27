'use client'

import Link from 'next/link'
import { ROUTES } from '@/config/routes'
import { useCategories } from '../hooks/use-categories'
import { Skeleton, CategoryIcon } from '@avdan/ui'

export function AllCategoriesPage() {
  const { data: categories, isLoading } = useCategories()

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href={ROUTES.home} className="hover:text-foreground">Home</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Categories</span>
      </nav>

      <h1 className="text-2xl font-bold tracking-tight text-foreground">All Categories</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories?.map((cat) => (
            <Link
              key={cat.id}
              href={ROUTES.category(cat.slug)}
              className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-6 text-center transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-secondary transition-all group-hover:bg-primary/10 group-hover:scale-105">
                <CategoryIcon name={cat.icon} className="h-9 w-9 text-muted-foreground group-hover:text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground group-hover:text-primary">{cat.name}</p>
                {cat.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{cat.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
