import { TrackingPage } from '@/modules/tracking/components/tracking-page'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  return {
    title: `Track Order #${id.slice(0, 8).toUpperCase()} — AVDAN`,
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params
  return <TrackingPage id={id} />
}
