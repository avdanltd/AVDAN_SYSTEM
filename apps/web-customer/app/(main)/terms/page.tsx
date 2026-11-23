import { LegalPage } from '@/modules/legal/components/legal-page'
import { LEGAL_UPDATED, TERMS_INTRO, TERMS_SECTIONS } from '@/modules/legal/content'

export const metadata = {
  title: 'Terms of Service: AVDAN',
  description: 'Terms of Service for the AVDAN marketplace and delivery service.',
}

export default function Page() {
  return <LegalPage title="Terms of Service" updated={LEGAL_UPDATED} intro={TERMS_INTRO} sections={TERMS_SECTIONS} />
}
