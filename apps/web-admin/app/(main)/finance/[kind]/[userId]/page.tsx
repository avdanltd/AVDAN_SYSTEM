import { notFound } from 'next/navigation'

import { PersonFinancePage } from '@/modules/finance/components/person-finance-page'
import type { FinanceKind } from '@/modules/finance/types'

interface Props {
  params: Promise<{ kind: string; userId: string }>
}

export default async function Page({ params }: Props) {
  const { kind, userId } = await params
  if (kind !== 'vendor' && kind !== 'rider' && kind !== 'customer') notFound()
  return <PersonFinancePage kind={kind as FinanceKind} userId={userId} />
}
