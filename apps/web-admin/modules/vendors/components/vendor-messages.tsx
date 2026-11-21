'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Textarea, cn } from '@avdan/ui'
import { formatDate } from '@/lib/format'
import { useSendVendorMessage, useVendorMessages } from '../hooks/use-vendor-messages'

// One-tap starting points for the things admins most often have to chase.
const QUICK_REPLIES = [
  'Please set your pickup location on the map: stand at the exact place riders will collect goods from and tap "Use my current location". It decides the delivery fee customers pay.',
  'Please add your full business address (state, LGA, city and street) in your store profile.',
  'Please add a short description of your business so customers know what you sell.',
]

/** The conversation between AVDAN staff and one vendor (polls for replies). */
export function VendorMessages({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  const { data, isLoading } = useVendorMessages(vendorId)
  const { mutate: send, isPending } = useSendVendorMessage(vendorId)
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Message {vendorName}</CardTitle>
        <p className="text-xs text-muted-foreground">
          They get it in their app and portal, by push and by email, and can reply here.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-80 space-y-2 overflow-y-auto rounded-md bg-muted/40 p-3">
          {isLoading ? (
            <Skeleton className="h-12 w-2/3" />
          ) : messages.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn('flex', m.sender_role === 'admin' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    m.sender_role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border',
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p
                    className={cn(
                      'mt-1 text-[10px]',
                      m.sender_role === 'admin' ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}
                  >
                    {m.sender_role === 'admin' ? 'AVDAN' : vendorName} · {formatDate(m.created_at)}
                    {m.sender_role === 'admin' && m.read ? ' · seen' : ''}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((q, i) => (
            <Button key={i} type="button" size="sm" variant="outline" className="h-auto whitespace-normal py-1 text-left text-xs" onClick={() => setDraft(q)}>
              {['Ask for pickup pin', 'Ask for address', 'Ask for description'][i]}
            </Button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
            }}
            placeholder="Write to the vendor… (Ctrl/Cmd + Enter to send)"
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
  )
}
