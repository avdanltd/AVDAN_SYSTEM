import { DisputeDetailPage } from '@/modules/disputes/components/dispute-detail-page'

interface Props {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: Props) {
  const { id } = await params
  return <DisputeDetailPage disputeId={id} />
}
