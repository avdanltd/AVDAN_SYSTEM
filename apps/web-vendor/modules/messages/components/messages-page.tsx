'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Button, Card, CardContent, Skeleton, Textarea, cn } from '@avdan/ui'
import { formatDateTime } from '@/lib/format'
import { useMessages, useSendMessage } from '../hooks/use-messages'

/** Messages between this store and the AVDAN team, e.g. about fixing an application. */
export function MessagesPage() {
  const { data, isLoading } = useMessages()
  const { mutate: send, isPending } = useSendMessage()
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const messages = data ?? []

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  function submit() {
    const text = draft.trim()
    if (!text || isPending) return
    send(text, { onSuccess: () => setDraft('') })
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Talk to the AVDAN team here, for example to fix something on your store application.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="max-h-[28rem] min-h-48 space-y-2 overflow-y-auto rounded-md bg-muted/40 p-3">
            {isLoading ? (
              <Skeleton className="h-12 w-2/3" />
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No messages yet. If the AVDAN team needs anything from you, it will show up here.
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn('flex', m.sender_role === 'vendor' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                      m.sender_role === 'vendor' ? 'bg-primary text-primary-foreground' : 'border border-border bg-background',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={cn(
                        'mt-1 text-[10px]',
                        m.sender_role === 'vendor' ? 'text-primary-foreground/70' : 'text-muted-foreground',
                      )}
                    >
                      {m.sender_role === 'vendor' ? 'You' : 'AVDAN'} · {formatDateTime(m.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
              }}
              placeholder="Write to AVDAN… (Ctrl/Cmd + Enter to send)"
              rows={3}
              maxLength={2000}
            />
            <Button onClick={submit} disabled={!draft.trim() || isPending} aria-label="Send message">
              <Send className="mr-2 h-4 w-4" />
              {isPending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
