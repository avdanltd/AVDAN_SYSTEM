'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Star, X } from 'lucide-react'
import { Button, Progress, cn, toast } from '@avdan/ui'
import { uploadsService } from '../services/uploads.service'

const MAX_IMAGES = 3
// Mirrors ALLOWED_CONTENT_TYPES in services/storage/service.py, minus HEIC — browsers don't
// render it, so it is left off the web accept list even though the backend still allows it
// for mobile uploads.
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILE_BYTES = 8 * 1024 * 1024 // matches settings.max_upload_bytes

interface Props {
  value: string[]
  onChange: (urls: string[]) => void
}

interface InFlightUpload {
  id: string
  name: string
  progress: number
}

/**
 * Product images for web-vendor. Same presign-then-direct-PUT-to-R2 flow as the mobile picker
 * (packages/mobile/src/lib/uploads.ts) so bytes never pass through our own API. The first URL is
 * the main image customers see first in listings; any other can be promoted to that slot.
 *
 * Capped at 3 on web (mobile stays at 5 — see image-picker-field.tsx) since the vendor dashboard
 * is desktop-first bulk data entry, not a single hero shot per product.
 */
export function ImageUploadField({ value, onChange }: Props) {
  const [uploads, setUploads] = useState<InFlightUpload[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const slotsUsed = value.length + uploads.length
  const atCap = slotsUsed >= MAX_IMAGES

  const uploadOne = (file: File) => {
    const id = `${file.name}-${crypto.randomUUID()}`
    setUploads((prev) => [...prev, { id, name: file.name, progress: 0 }])

    void (async () => {
      try {
        const presigned = await uploadsService.presign({
          prefix: 'products',
          content_type: file.type,
          content_length: file.size,
        })

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', presigned.upload_url)
          xhr.setRequestHeader('Content-Type', presigned.content_type)
          xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return
            const pct = Math.round((e.loaded / e.total) * 100)
            setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, progress: pct } : u)))
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve()
            else reject(new Error(xhr.status === 403 ? 'Upload link expired. Try again.' : `Upload failed (${xhr.status}).`))
          }
          xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'))
          xhr.send(file)
        })

        if (!presigned.public_url) {
          throw new Error('Upload succeeded but no image URL was returned.')
        }

        onChange([...value, presigned.public_url])
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to upload image')
      } finally {
        setUploads((prev) => prev.filter((u) => u.id !== id))
      }
    })()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (e.target) e.target.value = '' // allow re-selecting the same file later

    if (files.length === 0) return

    const remaining = MAX_IMAGES - slotsUsed
    if (remaining <= 0) {
      toast.info(`Up to ${MAX_IMAGES} images`, { description: 'Remove one before adding another.' })
      return
    }

    const accepted: File[] = []
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        toast.error(`"${file.name}" is not a JPEG, PNG, or WebP image`)
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`"${file.name}" is larger than 8 MB`)
        continue
      }
      accepted.push(file)
    }

    const toUpload = accepted.slice(0, remaining)
    if (accepted.length > toUpload.length) {
      toast.info(`Only ${remaining} image slot${remaining === 1 ? '' : 's'} left`, {
        description: `The first ${toUpload.length} were queued; the rest were skipped.`,
      })
    }

    toUpload.forEach(uploadOne)
  }

  const remove = (url: string) => {
    // The object is left in the bucket on purpose — deleting here would orphan the image if the
    // form is then cancelled, and an unreferenced object is cheap to leave behind.
    onChange(value.filter((u) => u !== url))
  }

  const makePrimary = (url: string) => {
    onChange([url, ...value.filter((u) => u !== url)])
  }

  return (
    <div className="space-y-2">
      {(value.length > 0 || uploads.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {value.map((url, i) => (
            <div key={url} className="group relative h-20 w-20 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Product image ${i + 1}`}
                className="h-20 w-20 rounded-lg border border-border object-cover"
              />

              {i === 0 ? (
                <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  Main
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => makePrimary(url)}
                  aria-label="Make this the main image"
                  className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-card transition-opacity group-hover:opacity-100"
                >
                  <Star className="h-3 w-3" />
                </button>
              )}

              <button
                type="button"
                onClick={() => remove(url)}
                aria-label="Remove image"
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {uploads.map((u) => (
            <div
              key={u.id}
              className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 p-2"
            >
              <ImagePlus className="h-4 w-4 animate-pulse text-muted-foreground" />
              <Progress value={u.progress} className="h-1.5 w-full" />
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        id="product-image-upload"
        onChange={handleFileChange}
        disabled={atCap}
      />

      <label htmlFor="product-image-upload">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={atCap}
          className={cn('h-9 gap-2', atCap ? 'cursor-not-allowed' : 'cursor-pointer')}
          asChild
        >
          <span>
            <ImagePlus className="h-4 w-4" />
            {value.length ? 'Add another image' : 'Add product images'}
          </span>
        </Button>
      </label>

      <p className="text-xs text-muted-foreground">
        {slotsUsed
          ? `${slotsUsed} of ${MAX_IMAGES}. The main image is what customers see first.`
          : `Up to ${MAX_IMAGES} images. JPEG, PNG or WebP, max 8 MB each.`}
      </p>
    </div>
  )
}
