import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { vendorsService } from '../services/vendors.service'

export function useBranchRequests() {
  return useQuery({
    queryKey: ['admin-branch-requests'],
    queryFn: () => vendorsService.getBranchRequests('pending'),
    refetchInterval: 60_000,
  })
}

export function useBusinesses(search: string) {
  return useQuery({
    queryKey: ['admin-businesses', search],
    queryFn: () => vendorsService.getBusinesses(search || undefined),
  })
}

/** Approve / reject a request, or link / unlink a vendor by hand. All refresh the same lists. */
export function useBranchActions() {
  const qc = useQueryClient()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-branch-requests'] })
    void qc.invalidateQueries({ queryKey: ['admin-vendor-profile'] })
    void qc.invalidateQueries({ queryKey: ['admin-businesses'] })
  }
  const onError = (err: Error) => toast.error(err.message ?? 'Something went wrong.')

  const approve = useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) => vendorsService.approveBranchRequest(id, name),
    onSuccess: () => toast.success('Linked. The vendor and the other branches have been told.'),
    onError,
    onSettled: refresh,
  })
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => vendorsService.rejectBranchRequest(id, reason),
    onSuccess: () => toast.success('Request rejected. The vendor can see your reason.'),
    onError,
    onSettled: refresh,
  })
  const link = useMutation({
    mutationFn: ({ vendorId, businessId, name }: { vendorId: string; businessId: string | null; name?: string }) =>
      vendorsService.setVendorBusiness(vendorId, businessId, name),
    onSuccess: () => toast.success('Vendor linked.'),
    onError,
    onSettled: refresh,
  })
  const unlink = useMutation({
    mutationFn: (vendorId: string) => vendorsService.unlinkVendor(vendorId),
    onSuccess: () => toast.success('Vendor unlinked.'),
    onError,
    onSettled: refresh,
  })
  return { approve, reject, link, unlink }
}
