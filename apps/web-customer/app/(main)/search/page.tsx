import { Suspense } from 'react'
import { SearchResultsPage } from '@/modules/search/components/search-results-page'

export const metadata = {
  title: 'Search — AVDAN',
  description: 'Search products and vendors on AVDAN.',
}

export default function Page() {
  return (
    <Suspense>
      <SearchResultsPage />
    </Suspense>
  )
}
