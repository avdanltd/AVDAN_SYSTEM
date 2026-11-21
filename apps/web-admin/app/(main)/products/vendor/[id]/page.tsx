import { VendorProductsPage } from '@/modules/products/components/vendor-products-page'

interface Props {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: Props) {
  const { id } = await params
  return <VendorProductsPage vendorId={id} />
}
