import { OrderDetailPage } from '@/modules/rider/components/order-detail-page'

interface Props {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: Props) {
  const { id } = await params
  return <OrderDetailPage orderId={id} />
}
