import { getWsUrl } from './api-client'
import { secureStorage } from './secure-storage'

type MessageHandler = (data: unknown) => void

/**
 * Each web app's lib/ws-client.ts relies on the browser sending the httpOnly `avdan_token`
 * cookie automatically on the WS handshake. Mobile has no cookies — auth is a Bearer token in
 * SecureStore — and React Native's WebSocket can't attach custom headers portably across
 * iOS/Android, so the access token goes as a `?token=` query param instead (the backend's
 * tracking router accepts either).
 */
class WsClient {
  private ws: WebSocket | null = null
  private handlers = new Set<MessageHandler>()
  private reconnectAttempts = 0
  private readonly maxReconnects = 10
  private closedByCaller = false

  async connect(path: string): Promise<void> {
    this.closedByCaller = false
    const { accessToken } = await secureStorage.getTokens()
    const query = accessToken ? `?token=${encodeURIComponent(accessToken)}` : ''
    this.ws = new WebSocket(`${getWsUrl()}${path}${query}`)

    this.ws.onmessage = (event: MessageEvent<string>) => {
      const data: unknown = JSON.parse(event.data)
      for (const handler of this.handlers) {
        handler(data)
      }
    }

    this.ws.onclose = () => {
      if (this.closedByCaller) return
      if (this.reconnectAttempts < this.maxReconnects) {
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000)
        this.reconnectAttempts++
        setTimeout(() => void this.connect(path), delay)
      }
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
    }
  }

  on(handler: MessageHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  disconnect(): void {
    this.closedByCaller = true
    this.ws?.close()
    this.ws = null
    this.handlers.clear()
    this.reconnectAttempts = 0
  }
}

export { WsClient }
