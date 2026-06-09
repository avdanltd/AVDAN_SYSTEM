import { useMutation } from '@tanstack/react-query'
import { hubService } from '../services/hub.service'
import { toast } from '@avdan/ui'

interface UploadEvidencePayload {
  orderId: string
  file: File
}

export function useUploadEvidence() {
  return useMutation({
    mutationFn: ({ orderId, file }: UploadEvidencePayload) =>
      hubService.uploadEvidence(orderId, file),
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to upload evidence photo')
    },
  })
}
