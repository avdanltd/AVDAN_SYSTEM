import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
import { messagesService } from '../services/messages.service'

/** The conversation with AVDAN. Re-checked every 10 s; opening it marks AVDAN's messages read. */
export function useMessages() {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['vendor-messages'],
    queryFn: async () => {
      const rows = await messagesService.list()
      void queryClient.invalidateQueries({ queryKey: ['attention'] })
      return rows
    },
    refetchInterval: 10_000,
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => messagesService.send(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendor-messages'] })
    },
    onError: (err: Error) => toast.error(err.message ?? 'Could not send your message.'),
  })
}
