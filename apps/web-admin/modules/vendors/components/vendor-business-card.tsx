'use client'

import { useState } from 'react'
import {
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
  Input,
  Label,
  cn,
} from '@avdan/ui'
import { useBranchActions, useBusinesses } from '../hooks/use-branches'
import type { VendorProfile } from '../types'

/** Which business this vendor belongs to, with the other branches, and the tools to fix it by hand. */
export function VendorBusinessCard({ vendor }: { vendor: VendorProfile }) {
  const { link, unlink } = useBranchActions()
  const [linkOpen, setLinkOpen] = useState(false)
  const [unlinkOpen, setUnlinkOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<string | 'new' | null>(null)
  const [newName, setNewName] = useState('')
  const { data: businesses } = useBusinesses(search.trim())

  const biz = vendor.business
  const req = vendor.link_request

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Business &amp; branches</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {biz ? (
          <>
            <p>
              Shown to customers as a branch of <span className="font-medium text-foreground">{biz.name}</span>.
            </p>
            <ul className="space-y-1">
              {biz.branches.map((b) => (
                <li key={b.vendor_id} className="flex justify-between gap-3">
                  <span className={cn(b.is_you && 'font-medium text-foreground')}>
                    {b.name}
                    {b.is_you && ' (this vendor)'}
                  </span>
                  <span className="text-muted-foreground">{b.place || 'location not set'}</span>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" onClick={() => setUnlinkOpen(true)}>
              Unlink from {biz.name}
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">Not part of a business: shown to customers on its own.</p>
            {req?.status === 'pending' && (
              <p className="rounded bg-warning-muted p-2 text-xs text-foreground">
                Waiting for you: says it is a branch of {req.target_name}. Decide on the Vendors page, under “Branch link requests”.
              </p>
            )}
            {req?.status === 'rejected' && <p className="text-xs text-muted-foreground">Last request rejected: {req.reason}</p>}
            <Button size="sm" variant="outline" onClick={() => { setLinkOpen(true); setPicked(null); setNewName(vendor.name) }}>
              Link to a business…
            </Button>
          </>
        )}
      </CardContent>

      {linkOpen && (
        <Dialog open onOpenChange={(o) => !o && setLinkOpen(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Link {vendor.name}</DialogTitle>
              <DialogDescription>
                Pick the business this store is a branch of, or start a new business from it. Customers will see the branches as one brand.
              </DialogDescription>
            </DialogHeader>
            <Input placeholder="Search businesses…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {(businesses ?? []).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setPicked(b.id)}
                  className={cn(
                    'w-full rounded-md border px-3 py-2 text-left text-sm',
                    picked === b.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary',
                  )}
                >
                  <span className="font-medium">{b.name}</span>{' '}
                  <span className="text-muted-foreground">
                    · {b.branch_count} branch{b.branch_count === 1 ? '' : 'es'}: {b.branches.map((x) => x.place || x.name).join(', ')}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPicked('new')}
                className={cn(
                  'w-full rounded-md border px-3 py-2 text-left text-sm',
                  picked === 'new' ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary',
                )}
              >
                Start a new business from this vendor
              </button>
            </div>
            {picked === 'new' && (
              <div className="space-y-1.5">
                <Label htmlFor="new-biz">Business name</Label>
                <Input id="new-biz" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setLinkOpen(false)} disabled={link.isPending}>
                Cancel
              </Button>
              <Button
                disabled={!picked || link.isPending || (picked === 'new' && newName.trim().length < 2)}
                onClick={() =>
                  link.mutate(
                    { vendorId: vendor.id, businessId: picked === 'new' ? null : picked, name: picked === 'new' ? newName.trim() : undefined },
                    { onSuccess: () => setLinkOpen(false) },
                  )
                }
              >
                {link.isPending ? 'Linking…' : 'Link'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={unlinkOpen}
        onOpenChange={setUnlinkOpen}
        title="Unlink vendor"
        description={`Customers will see ${vendor.name} on its own again. Its products, orders and money are not affected.`}
        confirmLabel="Unlink"
        loading={unlink.isPending}
        onConfirm={() => unlink.mutate(vendor.id, { onSuccess: () => setUnlinkOpen(false) })}
      />
    </Card>
  )
}
