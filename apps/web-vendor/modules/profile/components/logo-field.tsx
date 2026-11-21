'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage, Button, Progress, toast } from '@avdan/ui'
import { uploadsService } from '@/modules/catalog/services/uploads.service'

// Mirrors ALLOWED_CONTENT_TYPES in services/storage/service.py (HEIC left off: browsers can't show it).
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILE_BYTES = 8 * 1024 * 1024 // matches settings.max_upload_bytes

/**
 * The store logo customers see on the marketplace and the store page. Same presign-then-direct-PUT
 * flow as product photos (bytes never pass through our API). A new logo is saved straight away;
 * "Remove" clears it.
 */
export function LogoField({
  logoUrl,
  name,
  saving,
  onChange,
}: {
  logoUrl: string | null | undefined
  name: string
  saving: boolean
  /** Receives the new logo URL, or '' to remove it. */
  onChange: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const busy = progress !== null || saving

  async function upload(file: File) {
    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error('Use a JPEG, PNG or WebP image.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error('That image is too large. Keep it under 8 MB.')
      return
    }
    setProgress(0)
    try {
      const presigned = await uploadsService.presign({ prefix: 'vendor-logos', content_type: file.type, content_length: file.size })
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', presigned.upload_url)
        xhr.setRequestHeader('Content-Type', presigned.content_type)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(xhr.status === 403 ? 'Upload link expired. Try again.' : `Upload failed (${xhr.status}).`))
        xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'))
        xhr.send(file)
      })
      if (!presigned.public_url) throw new Error('Upload succeeded but no image URL was returned.')
      onChange(presigned.public_url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not upload the logo.')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-20 w-20 border border-border">
        {logoUrl && <AvatarImage src={logoUrl} alt={`${name} logo`} />}
        <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
          {name.slice(0, 2).toUpperCase() || 'V'}
        </AvatarFallback>
      </Avatar>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Store logo</p>
        <p className="text-xs text-muted-foreground">Shown to customers on the marketplace and your store page. A square image works best.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" />
            {logoUrl ? 'Change logo' : 'Upload logo'}
          </Button>
          {logoUrl && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange('')}>
              <Trash2 className="mr-2 h-4 w-4" /> Remove
            </Button>
          )}
        </div>
        {progress !== null && <Progress value={progress} className="h-1.5 w-40" />}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void upload(file)
          }}
        />
      </div>
    </div>
  )
}
