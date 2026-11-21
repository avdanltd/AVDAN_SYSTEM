'use client'

import { useVendorProfile } from '@/modules/vendors/hooks/use-vendor-profile'
import { ProductsPage } from './products-page'

/** One vendor's products: the page reached by clicking that vendor on the Products landing page. */
export function VendorProductsPage({ vendorId }: { vendorId: string }) {
  const { data: vendor } = useVendorProfile(vendorId)
  return <ProductsPage vendorId={vendorId} vendorName={vendor?.name} />
}
