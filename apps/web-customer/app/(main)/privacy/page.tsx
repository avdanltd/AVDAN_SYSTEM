import { LegalPage } from '@/modules/legal/components/legal-page'
import { LEGAL_UPDATED, PRIVACY_INTRO, PRIVACY_SECTIONS } from '@/modules/legal/content'

export const metadata = {
  title: 'Privacy Policy: AVDAN',
  description: 'Privacy Policy for the AVDAN marketplace and delivery service.',
}

export default function Page() {
  return <LegalPage title="Privacy Policy" updated={LEGAL_UPDATED} intro={PRIVACY_INTRO} sections={PRIVACY_SECTIONS} />
}
