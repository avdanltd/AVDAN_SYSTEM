import { OrderDetailPage } from '@/modules/orders/components/order-detail-page'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return {
    title: `Order #${id.slice(0, 8).toUpperCase()} — AVDAN`,
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params
  return <OrderDetailPage id={id} />
}
