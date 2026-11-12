'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Volume2, VolumeX } from 'lucide-react'

import { cn } from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useAttention } from '../hooks/use-attention'

const SOUND_KEY = 'avdan-vendor-order-sound'
const REPEAT_MS = 8_000

function readSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

/** Two short rising beeps. Browsers only allow audio after the page has had a click or key press,
 * so a blocked or suspended context is silently skipped — the visual alert still shows. */
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
 * Top-bar "NEW ORDER · n" alert. Shown only while paid orders are waiting for the vendor to accept:
 * a red pill that throbs and blinks, a chime that repeats until they are dealt with (vendor can
 * mute it), and a flashing tab title for when the dashboard is in a background tab.
 * Clicking it opens Orders, whose default tab is "New".
 */
export function NewOrderAlert() {
  const { data } = useAttention()
  const count = data?.orders ?? 0

  const [soundOn, setSoundOn] = useState(true)
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => setSoundOn(readSoundPref()), [])

  const getCtx = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctxRef.current = new Ctor()
    return ctxRef.current
  }, [])

  // Unlock audio on the vendor's first interaction with the page.
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

  // Chime now and every few seconds for as long as orders are waiting.
  useEffect(() => {
    if (count <= 0 || !soundOn) return
    const ring = () => {
      const ctx = getCtx()
      if (ctx) playChime(ctx)
    }
    ring()
    const id = window.setInterval(ring, REPEAT_MS)
    return () => window.clearInterval(id)
  }, [count, soundOn, getCtx])

  // Flash the tab title so a background tab still gets noticed.
  useEffect(() => {
    if (count <= 0) return
    const original = document.title
    let on = false
    const id = window.setInterval(() => {
      on = !on
      document.title = on ? `(${count}) NEW ORDER!` : original
    }, 1_000)
    return () => {
      window.clearInterval(id)
      document.title = original
    }
  }, [count])

  const toggleSound = () => {
    const next = !soundOn
    setSoundOn(next)
    try {
      localStorage.setItem(SOUND_KEY, next ? 'on' : 'off')
    } catch {
      /* preference just won't persist */
    }
    if (next) {
      const ctx = getCtx()
      if (ctx) playChime(ctx) // also counts as the user gesture that unlocks audio
    }
  }

  return (
    <div className="flex items-center gap-1">
      {count > 0 && (
        <Link
          href={ROUTES.orders}
          aria-live="assertive"
          aria-label={`${count} new ${count === 1 ? 'order' : 'orders'} waiting. Open orders.`}
          className="avdan-animate-throb flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-white shadow-lg shadow-destructive/40 sm:text-sm"
        >
          <span>New order</span>
          <span className="rounded-full bg-white px-1.5 text-destructive">{count}</span>
        </Link>
      )}
      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={soundOn}
        aria-label={soundOn ? 'New-order sound is on. Click to mute.' : 'New-order sound is off. Click to turn on.'}
        title={soundOn ? 'New-order sound on' : 'New-order sound off'}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted',
          soundOn && 'text-foreground',
        )}
      >
        {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </button>
    </div>
  )
}
