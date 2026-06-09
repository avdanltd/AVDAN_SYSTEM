import { QaPage } from '@/modules/hub/components/qa-page'

interface Props {
  params: Promise<{ id: string }>
}

export default async function HubQaPage({ params }: Props) {
  const { id } = await params
  return <QaPage orderId={id} />
}
