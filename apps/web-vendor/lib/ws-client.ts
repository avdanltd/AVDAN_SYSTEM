type MessageHandler = (data: unknown) => void

class WsClient {
  private ws: WebSocket | null = null
  private handlers = new Set<MessageHandler>()
  private reconnectAttempts = 0
  private readonly maxReconnects = 10

  connect(path: string): void {
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws'}${path}`
    this.ws = new WebSocket(wsUrl)

    this.ws.onmessage = (event: MessageEvent<string>) => {
      const data: unknown = JSON.parse(event.data)
      for (const handler of this.handlers) {
        handler(data)
      }
    }

    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnects) {
        const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000)
        this.reconnectAttempts++
        setTimeout(() => this.connect(path), delay)
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
    this.ws?.close()
    this.ws = null
    this.handlers.clear()
    this.reconnectAttempts = 0
  }
}

export { WsClient }
