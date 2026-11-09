import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { financeService, type Period } from '../services/finance.service'
import type { FinanceKind } from '../types'

export function useFinanceSummary(p: Period) {
  return useQuery({
    queryKey: ['finance-summary', p],
    queryFn: () => financeService.summary(p),
    placeholderData: keepPreviousData,
  })
}

export function usePendingRelease(p: Period, enabled: boolean) {
  return useQuery({
    queryKey: ['finance-pending', p],
    queryFn: () => financeService.pending(p),
    enabled,
  })
}

export function useFinancePeople(kind: FinanceKind, p: Period, search: string) {
  return useQuery({
    queryKey: ['finance-people', kind, p, search],
    queryFn: () => financeService.people(kind, p, search || undefined),
    placeholderData: keepPreviousData,
  })
}

export function useFinancePerson(kind: FinanceKind, userId: string, p: Period) {
  return useQuery({
    queryKey: ['finance-person', kind, userId, p],
    queryFn: () => financeService.person(kind, userId, p),
  })
}
