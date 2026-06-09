'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, XCircle, Upload, X, ImageIcon } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Textarea,
  OrderStatusBadge,
  ConfirmDialog,
  Skeleton,
  Separator,
  cn,
} from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { formatKobo, formatDate } from '@/lib/format'
import { useHubOrder } from '../hooks/use-hub-order'
import { useQaPass } from '../hooks/use-qa-pass'
import { useQaFail } from '../hooks/use-qa-fail'
import { useUploadEvidence } from '../hooks/use-upload-evidence'

interface QaPageProps {
  orderId: string
}

export function QaPage({ orderId }: QaPageProps) {
  const router = useRouter()
  const { data: order, isLoading, error } = useHubOrder(orderId)
  const { mutate: qaPass, isPending: isPassing } = useQaPass()
  const { mutate: qaFail, isPending: isFailing } = useQaFail()
  const { mutate: uploadEvidence, isPending: isUploading } = useUploadEvidence()

  const [notes, setNotes] = useState('')
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([])
  const [evidencePreviews, setEvidencePreviews] = useState<string[]>([])

  const [passDialogOpen, setPassDialogOpen] = useState(false)
  const [failDialogOpen, setFailDialogOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const isBusy = isPassing || isFailing || isUploading

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    for (const file of files) {
      const preview = URL.createObjectURL(file)
      setEvidencePreviews((prev) => [...prev, preview])

      uploadEvidence(
        { orderId, file },
        {
          onSuccess: (data) => {
            setEvidenceUrls((prev) => [...prev, data.url])
          },
          onError: () => {
            // Remove preview if upload fails
            setEvidencePreviews((prev) => prev.filter((p) => p !== preview))
            URL.revokeObjectURL(preview)
          },
        },
      )
    }

    // Reset input so same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeEvidence = (index: number) => {
    setEvidencePreviews((prev) => {
      const updated = [...prev]
      const url = updated[index]
      if (url) URL.revokeObjectURL(url)
      updated.splice(index, 1)
      return updated
    })
    setEvidenceUrls((prev) => {
      const updated = [...prev]
      updated.splice(index, 1)
      return updated
    })
  }

  const handleConfirmPass = () => {
    qaPass(
      { orderId, notes },
      {
        onSuccess: () => {
          setPassDialogOpen(false)
          router.push(ROUTES.orders)
        },
      },
    )
  }

  const handleConfirmFail = () => {
    qaFail(
      { orderId, notes, evidence_urls: evidenceUrls },
      {
        onSuccess: () => {
          setFailDialogOpen(false)
          router.push(ROUTES.orders)
        },
      },
    )
  }

  const canFail = notes.trim().length > 0

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <p className="text-sm text-destructive">
          Failed to load order. Please go back and try again.
        </p>
        <Link href={ROUTES.orders} className="mt-3 inline-block">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Orders
          </Button>
        </Link>
      </div>
    )
  }

  const shortId = order.id.slice(0, 8).toUpperCase()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Back + Header */}
      <div>
        <Link href={ROUTES.orders}>
          <Button variant="ghost" size="sm" className="-ml-2 mb-3 h-9">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Queue
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-foreground">Order #{shortId}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {order.vendor_name && `From ${order.vendor_name} · `}
          Created {formatDate(order.created_at)}
        </p>
      </div>

      {/* Items checklist */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Items to Check</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {order.items && order.items.length > 0 ? (
            <div className="divide-y divide-border">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                      {item.quantity}×
                    </span>
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatKobo(item.price_kobo)} each
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No item details available.</p>
          )}
          <Separator className="my-3" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Total</span>
            <span className="text-base font-bold text-foreground">
              {formatKobo(order.total_kobo)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* QA notes + evidence */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">QA Inspection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="qa-notes">
              Notes
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (required for FAIL)
              </span>
            </label>
            <Textarea
              id="qa-notes"
              placeholder="Describe what you observed during inspection…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px] resize-none text-sm"
              disabled={isBusy}
            />
          </div>

          {/* Evidence upload */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Evidence Photos
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (for failures — upload photos of defects)
              </span>
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              id="evidence-upload"
              onChange={handleFileChange}
              disabled={isBusy}
            />

            <label htmlFor="evidence-upload">
              <Button
                variant="outline"
                size="sm"
                className="h-10 cursor-pointer gap-2"
                asChild
              >
                <span>
                  <Upload className="h-4 w-4" />
                  {isUploading ? 'Uploading…' : 'Upload Photos'}
                </span>
              </Button>
            </label>

            {/* Previews */}
            {evidencePreviews.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-1">
                {evidencePreviews.map((src, i) => (
                  <div key={src} className="group relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`Evidence ${i + 1}`}
                      className="h-20 w-20 rounded-lg border border-border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeEvidence(i)}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {isUploading && (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-border">
                    <ImageIcon className="h-6 w-6 animate-pulse text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Button
          size="lg"
          className={cn(
            'h-14 gap-2 text-base font-semibold',
            'bg-green-600 hover:bg-green-700 text-white',
          )}
          onClick={() => setPassDialogOpen(true)}
          disabled={isBusy}
        >
          <CheckCircle2 className="h-5 w-5" />
          PASS
        </Button>

        <Button
          size="lg"
          variant="destructive"
          className="h-14 gap-2 text-base font-semibold"
          onClick={() => setFailDialogOpen(true)}
          disabled={isBusy || !canFail}
          title={!canFail ? 'Add notes before marking as failed' : undefined}
        >
          <XCircle className="h-5 w-5" />
          FAIL
        </Button>

        {!canFail && (
          <p className="col-span-2 -mt-2 text-center text-xs text-muted-foreground">
            Enter inspection notes before recording a failure.
          </p>
        )}
      </div>

      {/* Confirm pass dialog */}
      <ConfirmDialog
        open={passDialogOpen}
        onOpenChange={setPassDialogOpen}
        title="Confirm QA Pass"
        description="This will mark the order ready for dispatch and assign it to a rider. Continue?"
        confirmLabel="Confirm Pass"
        loading={isPassing}
        onConfirm={handleConfirmPass}
      />

      {/* Confirm fail dialog */}
      <ConfirmDialog
        open={failDialogOpen}
        onOpenChange={setFailDialogOpen}
        title="Confirm QA Failure"
        description="This will send the order back to the vendor for remediation. The customer will be notified. Continue?"
        confirmLabel="Confirm Failure"
        destructive
        loading={isFailing}
        onConfirm={handleConfirmFail}
      />
    </div>
  )
}
