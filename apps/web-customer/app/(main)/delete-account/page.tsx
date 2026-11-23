import { LegalPage } from '@/modules/legal/components/legal-page'
import { LEGAL_UPDATED, DELETE_INTRO, DELETE_SECTIONS } from '@/modules/legal/content'

export const metadata = {
  title: 'Delete your AVDAN account: AVDAN',
  description: 'Delete your AVDAN account for the AVDAN marketplace and delivery service.',
}

export default function Page() {
  return <LegalPage title="Delete your AVDAN account" updated={LEGAL_UPDATED} intro={DELETE_INTRO} sections={DELETE_SECTIONS} />
}
