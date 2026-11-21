import { VendorProfilePage } from '@/modules/vendors/components/vendor-profile-page'

interface Props {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: Props) {
  const { id } = await params
  return <VendorProfilePage vendorId={id} />
}
