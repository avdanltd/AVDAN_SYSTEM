'use client'

import { useState } from 'react'
import { Building2, Clock, XCircle } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Input,
  Label,
  Skeleton,
  Textarea,
  cn,
} from '@avdan/ui'
import { useBranchActions, useBusinessSuggestions, useMyBusiness } from '../hooks/use-branches'

/**
 * "Is your store a branch of a business?" Each branch stays its own store (own login, products,
 * orders and money); AVDAN links them so customers see one brand. A request is checked by AVDAN
 * before anything changes.
 */
export function BranchesPage() {
  const { data, isLoading } = useMyBusiness()
  const { request, cancel, leave } = useBranchActions()
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<{ kind: 'business' | 'vendor' | 'brand'; id?: string; name: string } | null>(null)
  const [note, setNote] = useState('')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const { data: suggestions } = useBusinessSuggestions(q)

  if (isLoading || !data) return <Skeleton className="h-64 max-w-2xl" />
  const { business, request: latest } = data
  const pending = latest?.status === 'pending'

  function submit() {
    if (!pick) return
    request.mutate(
      {
        ...(pick.kind === 'business' ? { business_id: pick.id } : {}),
        ...(pick.kind === 'vendor' ? { vendor_id: pick.id } : {}),
        ...(pick.kind === 'brand' ? { brand_name: pick.name } : {}),
        note: note.trim() || undefined,
      },
      { onSuccess: () => { setPick(null); setQ(''); setNote('') } },
    )
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Branches</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          If your store is one branch of a business with other stores on AVDAN, link them so customers see one brand with all its
          branches. Each branch keeps its own login, products, orders and money.
        </p>
      </div>

      {business ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> You are a branch of {business.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="space-y-1">
              {business.branches.map((b) => (
                <li key={b.vendor_id} className="flex justify-between gap-3">
                  <span className={cn(b.is_you && 'font-medium text-foreground')}>
                    {b.name}
                    {b.is_you && ' (this store)'}
                  </span>
                  <span className="text-muted-foreground">{b.place || 'location not set'}</span>
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" onClick={() => setLeaveOpen(true)}>
              Leave this business
            </Button>
          </CardContent>
        </Card>
      ) : pending ? (
        <Card>
          <CardContent className="flex gap-3 p-4 text-sm">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="space-y-2">
              <p className="font-medium text-foreground">Waiting for AVDAN</p>
              <p className="text-muted-foreground">
                You asked to be linked as a branch of <span className="text-foreground">{latest?.target_name}</span>. We will check it
                and let you know. You may be asked for proof, so keep an eye on your messages.
              </p>
              <Button variant="outline" size="sm" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                Cancel request
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Is this store a branch of another business?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {latest?.status === 'rejected' && (
              <p className="flex gap-2 rounded bg-destructive/10 p-2 text-sm text-destructive">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> Your last request was not approved: {latest.reason}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="biz-q">Start typing the business name</Label>
              <Input
                id="biz-q"
                value={pick ? pick.name : q}
                onChange={(e) => { setQ(e.target.value); setPick(null) }}
                placeholder="e.g. Bokku Mart"
              />
            </div>

            {!pick && q.trim().length >= 2 && (
              <div className="space-y-1">
                {(suggestions ?? []).map((s) => (
                  <button
                    key={`${s.kind}-${s.id}`}
                    type="button"
                    onClick={() => setPick({ kind: s.kind as 'business' | 'vendor', id: s.id, name: s.name })}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-secondary"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{s.detail}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPick({ kind: 'brand', name: q.trim() })}
                  className="w-full rounded-md border border-dashed border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary"
                >
                  My business isn&apos;t listed: use “{q.trim()}”
                </button>
              </div>
            )}

            {pick && (
              <div className="space-y-2">
                <p className="text-sm">
                  Request to be linked as a branch of <Badge variant="secondary">{pick.name}</Badge>
                </p>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything that helps us confirm it (optional): who owns the business, other branch locations…"
                  rows={3}
                  maxLength={1000}
                />
                <div className="flex gap-2">
                  <Button onClick={submit} disabled={request.isPending}>
                    {request.isPending ? 'Sending…' : 'Request to join'}
                  </Button>
                  <Button variant="outline" onClick={() => setPick(null)} disabled={request.isPending}>
                    Change
                  </Button>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Not a branch of anything? You don&apos;t need to do anything: your store shows on its own.
            </p>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Leave this business?"
        description="Your store will show to customers on its own again. Your products, orders and money are not affected, and the other branches stay linked."
        confirmLabel="Leave"
        loading={leave.isPending}
        onConfirm={() => leave.mutate(undefined, { onSuccess: () => setLeaveOpen(false) })}
      />
    </div>
  )
}
