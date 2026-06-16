import { vendorsService } from '@/modules/vendors/services/vendors.service'
import { VendorDetailPage } from '@/modules/vendors/components/vendor-detail-page'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  try {
    const vendor = await vendorsService.getVendor(slug)
    return {
      title: `${vendor.name} — Order on AVDAN`,
      description: vendor.description ?? `Order from ${vendor.name} on AVDAN.`,
    }
  } catch {
    return {
      title: 'Vendor — AVDAN',
    }
  }
}

export default async function VendorPage({ params }: Props) {
  const { slug } = await params
  return <VendorDetailPage slug={slug} />
}
