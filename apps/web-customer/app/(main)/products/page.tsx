import { Suspense } from 'react'
import { ProductsPage } from '@/modules/products/components/products-page'

export const metadata = {
  title: 'All Products — AVDAN',
  description: 'Browse products from all vendors on AVDAN.',
}

export default function Page() {
  return (
    <Suspense>
      <ProductsPage />
    </Suspense>
  )
}
