'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GitBranch, X } from 'lucide-react'
import { Button, Card, CardContent } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useMyBusiness } from '../hooks/use-branches'

const KEY = 'avdan-branch-prompt-dismissed'

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** One-time nudge on the dashboard: "Is this store a branch of another business?". Gone once the
 * store is linked, has a request waiting, or the vendor dismisses it (remembered on this device). */
export function BranchPrompt() {
  const { data } = useMyBusiness()
  const [dismissed, setDismissed] = useState(read)

  if (!data || dismissed || data.business || data.request?.status === 'pending') return null

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex items-start gap-3 p-4">
        <GitBranch className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1 space-y-2 text-sm">
          <p className="font-medium text-foreground">Is this store a branch of another business?</p>
          <p className="text-muted-foreground">
            If the same business has other stores on AVDAN, link them so customers see one brand with all its branches.
          </p>
          <div className="flex gap-2">
            <Link href={ROUTES.branches}>
              <Button size="sm">Yes, link my branches</Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                try { window.localStorage.setItem(KEY, '1') } catch { /* ignore */ }
                setDismissed(true)
              }}
            >
              No, we&apos;re independent
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            try { window.localStorage.setItem(KEY, '1') } catch { /* ignore */ }
            setDismissed(true)
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  )
}
