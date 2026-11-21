import { apiClient } from '@/lib/api-client'

export interface VendorMessage {
  id: string
  sender_role: 'admin' | 'vendor'
  body: string
  created_at: string
  read: boolean
}

export const messagesService = {
  list: () => apiClient.get<VendorMessage[]>('/vendors/me/messages'),
  send: (body: string) => apiClient.post<VendorMessage>('/vendors/me/messages', { body }),
}
