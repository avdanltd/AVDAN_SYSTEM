'use client'

import { useState } from 'react'
import { Crosshair, X } from 'lucide-react'

import { lgasForState, NIGERIA_STATES } from '@avdan/types'
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from '@avdan/ui'

export interface LocationValue {
  state?: string
  lga?: string
  /** "lat,lng" of the customer, when sorting nearest-first. */
  near?: string
}

/** Parses the "lat,lng" form into the two API params. */
export function nearParams(near?: string): { near_lat?: string; near_lng?: string } {
  if (!near) return {}
  const [lat, lng] = near.split(',')
  return lat && lng ? { near_lat: lat, near_lng: lng } : {}
}

/**
 * Narrow vendors or products by where they are: State, then Local Government, or "Near me" to
 * put the closest vendors first. Near-me asks the browser for the customer's location only when
 * they press the button.
 */
export function LocationFilter({
  value,
  onChange,
}: {
  value: LocationValue
  onChange: (patch: LocationValue) => void
}) {
  const [locating, setLocating] = useState(false)
  const lgas = value.state ? lgasForState(value.state) : []
  const active = Boolean(value.state || value.lga || value.near)

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error('Your browser cannot share its location.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        onChange({ near: `${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}` })
      },
      () => {
        setLocating(false)
        toast.error('Could not get your location. Allow location access and try again.')
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filter by location">
      <Select
        value={value.state ?? 'all'}
        onValueChange={(v) => onChange({ state: v === 'all' ? undefined : v, lga: undefined })}
      >
        <SelectTrigger className="h-9 w-44 text-sm">
          <SelectValue placeholder="All states" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All states</SelectItem>
          {NIGERIA_STATES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.lga ?? 'all'}
        disabled={!value.state}
        onValueChange={(v) => onChange({ lga: v === 'all' ? undefined : v })}
      >
        <SelectTrigger className="h-9 w-48 text-sm">
          <SelectValue placeholder={value.state ? 'All local governments' : 'Pick a state first'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All local governments</SelectItem>
          {lgas.map((l) => (
            <SelectItem key={l} value={l}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        size="sm"
        variant={value.near ? 'default' : 'outline'}
        className="gap-1.5"
        disabled={locating}
        onClick={() => (value.near ? onChange({ near: undefined }) : useMyLocation())}
      >
        <Crosshair className="h-4 w-4" />
        {locating ? 'Locating…' : value.near ? 'Nearest to me' : 'Near me'}
      </Button>

      {active && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1 text-xs text-muted-foreground"
          onClick={() => onChange({ state: undefined, lga: undefined, near: undefined })}
        >
          <X className="h-3.5 w-3.5" />
          Clear location
        </Button>
      )}
    </div>
  )
}
