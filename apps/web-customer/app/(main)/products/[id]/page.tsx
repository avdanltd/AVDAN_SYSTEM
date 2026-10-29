import { ProductDetailPage } from '@/modules/products/components/product-detail-page'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata() {
  return {
    title: `Product — AVDAN`,
    description: `View product details on AVDAN.`,
  }
}

export default async function Page({ params }: PageProps) {
  const { id } = await params
  return <ProductDetailPage productId={id} />
}
