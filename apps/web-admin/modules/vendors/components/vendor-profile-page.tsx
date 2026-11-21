'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDashed, ExternalLink, XCircle } from 'lucide-react'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Skeleton,
  Textarea,
} from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { formatDate } from '@/lib/format'
import { useUpdateVendorStatus } from '../hooks/use-update-vendor-status'
import { useVendorProfile } from '../hooks/use-vendor-profile'
import { VendorMessages } from './vendor-messages'

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  active: 'default',
  suspended: 'secondary',
  rejected: 'destructive',
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  )
}

/**
 * Everything on one vendor an admin needs to decide on their application: what they've filled in,
 * what is still missing (with a one-click way to message them about it), their pickup pin, who
 * they are, and what they've listed. Approve / suspend / reject live here too.
 */
export function VendorProfilePage({ vendorId }: { vendorId: string }) {
  const router = useRouter()
  const { data: v, isLoading, isError, refetch } = useVendorProfile(vendorId)
  const { mutate: updateStatus, isPending: updating } = useUpdateVendorStatus()
  const [approveOpen, setApproveOpen] = useState(false)
  const [action, setAction] = useState<'suspend' | 'reject' | null>(null)
  const [reason, setReason] = useState('')

  const back = (
    <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => router.push(ROUTES.vendors)}>
      <ArrowLeft className="mr-1 h-4 w-4" /> All vendors
    </Button>
  )

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        {back}
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (isError || !v) {
    return (
      <div className="flex flex-col gap-4 p-6">
        {back}
        <EmptyState
          icon={<XCircle className="h-6 w-6" />}
          title="Couldn't load this vendor"
          description="It may have been removed, or the connection dropped."
          action={{ label: 'Retry', onClick: () => void refetch() }}
        />
      </div>
    )
  }

  const place = [v.street, v.city, v.lga, v.state].filter(Boolean).join(', ')
  const mapsUrl =
    v.lat != null && v.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`
      : place
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
        : null

  return (
    <div className="flex flex-col gap-4 p-6">
      {back}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {v.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.logo_url} alt="" className="h-14 w-14 rounded-lg border border-border object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-lg font-semibold text-muted-foreground">
              {v.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">{v.name}</h1>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={STATUS_VARIANTS[v.status] ?? 'secondary'} className="capitalize">
                {v.status}
              </Badge>
              Joined {formatDate(v.created_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {v.status !== 'active' && (
            <Button onClick={() => setApproveOpen(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
            </Button>
          )}
          {v.status === 'active' && (
            <Button variant="outline" onClick={() => { setAction('suspend'); setReason('') }}>
              Suspend
            </Button>
          )}
          {v.status !== 'rejected' && (
            <Button variant="outline" onClick={() => { setAction('reject'); setReason('') }}>
              Reject
            </Button>
          )}
        </div>
      </div>

      {v.missing.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning-muted p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-foreground">Not ready to approve yet. Still missing:</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {v.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            <p className="mt-1 text-muted-foreground">Message the vendor below so they can fix it straight away.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Application checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {v.checklist.map((c) => (
                <li key={c.key} className="flex gap-2.5 text-sm">
                  {c.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : c.required ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">
                      {c.label}
                      {!c.required && <span className="ml-1.5 text-xs font-normal text-muted-foreground">optional</span>}
                    </p>
                    {c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Location &amp; pickup point</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <Row label="State" value={v.state} />
            <Row label="LGA" value={v.lga} />
            <Row label="City / town" value={v.city} />
            <Row label="Street" value={v.street ?? v.address} />
            <Row label="Landmark" value={v.landmark} />
            <Row
              label="Map pin"
              value={v.lat != null && v.lng != null ? `${v.lat.toFixed(5)}, ${v.lng.toFixed(5)}` : 'Not pinned'}
            />
            {mapsUrl && (
              <div className="pt-2">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Open in Google Maps <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Business</CardTitle>
          </CardHeader>
          <CardContent>
            {v.description?.trim() ? (
              <p className="whitespace-pre-wrap text-sm text-foreground">{v.description}</p>
            ) : (
              <p className="text-sm text-warning">No business description written.</p>
            )}
            <div className="mt-3 divide-y divide-border border-t border-border">
              <Row label="Store link" value={`avdanstore.com/vendors/${v.slug}`} />
              <Row
                label="Products"
                value={`${v.product_total} (${v.product_approved} live, ${v.product_pending} awaiting approval)`}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Owner &amp; payout</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <Row label="Name" value={v.owner_name} />
            <Row
              label="Phone"
              value={v.owner_phone ? <a className="text-primary hover:underline" href={`tel:${v.owner_phone}`}>{v.owner_phone}</a> : null}
            />
            <Row
              label="Email"
              value={v.owner_email ? <a className="text-primary hover:underline" href={`mailto:${v.owner_email}`}>{v.owner_email}</a> : null}
            />
            <Row label="Account status" value={v.owner_status} />
            <Row
              label="Payout account"
              value={v.payout_account_last4 ? `${v.payout_bank_name ?? 'Bank'} · ${v.payout_account_name ?? ''} · ••••${v.payout_account_last4}` : null}
            />
          </CardContent>
        </Card>
      </div>

      <VendorMessages vendorId={v.id} vendorName={v.name} />

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve vendor"
        description={
          v.missing.length > 0
            ? `${v.name} is still missing: ${v.missing.join(', ')}. Approve anyway? Without a pickup pin, customers are charged only the flat delivery fee.`
            : `Approve ${v.name}? They will be able to list products and receive orders.`
        }
        confirmLabel="Approve"
        loading={updating}
        onConfirm={() =>
          updateStatus({ id: v.id, status: 'active' }, { onSuccess: () => { setApproveOpen(false); void refetch() } })
        }
      />

      {action && (
        <Dialog open onOpenChange={(o) => !o && setAction(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{action === 'suspend' ? 'Suspend vendor' : 'Reject vendor'}</DialogTitle>
              <DialogDescription>
                {action === 'suspend' ? 'Suspend' : 'Reject'} {v.name}? Give a reason.
              </DialogDescription>
            </DialogHeader>
            <Textarea placeholder="Reason (required)…" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setAction(null)} disabled={updating}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!reason.trim() || updating}
                onClick={() =>
                  updateStatus(
                    { id: v.id, status: action === 'suspend' ? 'suspended' : 'rejected', reason: reason.trim() },
                    { onSuccess: () => { setAction(null); void refetch() } },
                  )
                }
              >
                {updating ? 'Saving…' : action === 'suspend' ? 'Suspend' : 'Reject'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
