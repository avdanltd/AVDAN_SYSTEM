'use client'

import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react'
import { Volume2, VolumeX } from 'lucide-react'

import { cn } from '../../lib/utils'

const DEFAULT_REPEAT_MS = 8_000

type AudioCtor = typeof AudioContext

function readPref(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'off'
  } catch {
    return true
  }
}

/** Two short rising beeps. Silently skipped when the browser has not yet allowed audio. */
function playChime(ctx: AudioContext) {
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  if (ctx.state !== 'running') return
  const now = ctx.currentTime
  ;[880, 1175].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const start = now + i * 0.22
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.22)
  })
}

/**
 * Alert chime with a per-browser on/off preference. While `active` it chimes now and then every
 * `repeatMs`. Browsers only allow audio after the first click or key press on the page, so the
 * context is unlocked on that first interaction (and by the toggle itself).
 */
export function useAlertChime({
  active,
  storageKey,
  repeatMs = DEFAULT_REPEAT_MS,
}: {
  active: boolean
  storageKey: string
  repeatMs?: number
}) {
  const [soundOn, setSoundOn] = useState(true)
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => setSoundOn(readPref(storageKey)), [storageKey])

  const getCtx = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current
    const Ctor: AudioCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
    if (!Ctor) return null
    ctxRef.current = new Ctor()
    return ctxRef.current
  }, [])

  useEffect(() => {
    const unlock = () => {
      const ctx = getCtx()
      if (ctx?.state === 'suspended') void ctx.resume().catch(() => undefined)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [getCtx])

  useEffect(() => {
    if (!active || !soundOn) return
    const ring = () => {
      const ctx = getCtx()
      if (ctx) playChime(ctx)
    }
    ring()
    const id = window.setInterval(ring, repeatMs)
    return () => window.clearInterval(id)
  }, [active, soundOn, repeatMs, getCtx])

  const toggle = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev
      try {
        localStorage.setItem(storageKey, next ? 'on' : 'off')
      } catch {
        /* preference just won't persist */
      }
      if (next) {
        const ctx = getCtx()
        if (ctx) playChime(ctx) // the click that turns it on also unlocks audio
      }
      return next
    })
  }, [storageKey, getCtx])

  return { soundOn, toggle }
}

/** Small speaker button for a chime's on/off preference. */
export function SoundToggle({
  soundOn,
  onToggle,
  label = 'Alert sound',
  className,
}: {
  soundOn: boolean
  onToggle: () => void
  label?: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={soundOn}
      aria-label={soundOn ? `${label} is on. Click to mute.` : `${label} is off. Click to turn on.`}
      title={soundOn ? `${label} on` : `${label} off`}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted',
        soundOn && 'text-foreground',
        className,
      )}
    >
      {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    </button>
  )
}

interface LinkProps {
  href: string
  className?: string
  children?: ReactNode
  'aria-label'?: string
  'aria-live'?: 'assertive' | 'polite' | 'off'
}

/**
 * Top-bar alert for work waiting on a person: a red pill ("NEW ORDER · 3") that throbs and blinks,
 * a repeating chime they can mute, and a flashing tab title for background tabs. Renders nothing
 * when `count` is 0 (only the mute button stays). Pass the app's own `Link` as `linkAs` so a click
 * is a client-side navigation to `href`.
 */
export function AttentionAlert({
  count,
  label,
  href,
  linkAs: LinkAs,
  storageKey,
  noun = 'item',
}: {
  count: number
  /** Uppercase headline, e.g. "New order". */
  label: string
  href: string
  linkAs: ComponentType<LinkProps>
  storageKey: string
  /** Singular noun for the screen-reader label. */
  noun?: string
}) {
  const { soundOn, toggle } = useAlertChime({ active: count > 0, storageKey })

  useEffect(() => {
    if (count <= 0) return
    const original = document.title
    let on = false
    const id = window.setInterval(() => {
      on = !on
      document.title = on ? `(${count}) ${label.toUpperCase()}!` : original
    }, 1_000)
    return () => {
      window.clearInterval(id)
      document.title = original
    }
  }, [count, label])

  return (
    <div className="flex items-center gap-1">
      {count > 0 && (
        <LinkAs
          href={href}
          aria-live="assertive"
          aria-label={`${count} ${label.toLowerCase()} — ${count} ${noun}${count === 1 ? '' : 's'} waiting. Open.`}
          className="avdan-animate-throb flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-white shadow-lg shadow-destructive/40 sm:text-sm"
        >
          <span>{label}</span>
          <span className="rounded-full bg-white px-1.5 text-destructive">{count}</span>
        </LinkAs>
      )}
      <SoundToggle soundOn={soundOn} onToggle={toggle} />
    </div>
  )
}
