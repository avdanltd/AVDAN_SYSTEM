'use client'

import * as React from 'react'

import { Skeleton } from '../ui/skeleton'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  loading?: boolean
  skeletonRows?: number
  emptyMessage?: string
  className?: string
  onRowClick?: (row: T) => void
  /** The fetch that populated `data` failed — renders a distinct "couldn't load" state with a
   * retry action instead of silently falling back to the empty-data message, so a real outage
   * never looks identical to "there's genuinely nothing here." */
  error?: boolean
  errorMessage?: string
  onRetry?: () => void
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  skeletonRows = 5,
  emptyMessage = 'No results.',
  className,
  onRowClick,
  error = false,
  errorMessage = "Couldn't load this data.",
  onRetry,
}: DataTableProps<T>) {
  return (
    <div className={cn('w-full overflow-auto rounded-lg border border-border', className)}>
      <table className="w-full caption-bottom text-sm">
        <thead className="border-b border-border bg-secondary">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'h-11 px-4 text-left align-middle font-medium text-muted-foreground',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))
          ) : error ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <p className="text-sm font-medium text-destructive">{errorMessage}</p>
                {onRetry && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
                    Retry
                  </Button>
                )}
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className={cn(
                  'border-b border-border transition-colors last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-secondary',
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3 align-middle', col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
