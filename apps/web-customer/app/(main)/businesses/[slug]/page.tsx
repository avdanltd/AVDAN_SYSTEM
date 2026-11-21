import { vendorsService } from '@/modules/vendors/services/vendors.service'
import { BusinessPage } from '@/modules/vendors/components/business-page'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  try {
    const biz = await vendorsService.getBusiness(slug)
    return {
      title: `${biz.name}: ${biz.branch_count} branches on AVDAN`,
      description: biz.description ?? `Shop ${biz.name} on AVDAN, with branches in ${biz.branches.length} locations.`,
    }
  } catch {
    return { title: 'Business: AVDAN' }
  }
}

export default async function Page({ params }: Props) {
  const { slug } = await params
  return <BusinessPage slug={slug} />
}
