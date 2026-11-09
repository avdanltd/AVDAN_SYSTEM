import { apiClient } from '@/lib/api-client'
import type { FinanceKind, FinanceSummary, PendingRelease, PersonDetail, PersonRow } from '../types'

export interface Period {
  start: string
  end: string
}

export const financeService = {
  summary: (p: Period) => apiClient.get<FinanceSummary>('/admin/finance/summary', { ...p }),
  pending: (p: Period) => apiClient.get<PendingRelease>('/admin/finance/pending', { ...p }),
  people: (kind: FinanceKind, p: Period, search?: string) =>
    apiClient.get<PersonRow[]>('/admin/finance/people', { kind, ...p, ...(search ? { search } : {}) }),
  person: (kind: FinanceKind, userId: string, p: Period) =>
    apiClient.get<PersonDetail>(`/admin/finance/people/${kind}/${userId}`, { ...p }),
}
