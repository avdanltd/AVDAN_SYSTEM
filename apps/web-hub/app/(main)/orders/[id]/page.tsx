import { OrderDetailPage } from '@/modules/hub/components/order-detail-page'

interface Props {
  params: Promise<{ id: string }>
}

export default async function HubOrderDetailPage({ params }: Props) {
  const { id } = await params
  return <OrderDetailPage orderId={id} />
}
