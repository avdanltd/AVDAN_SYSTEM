'use client'

import { useEffect, useState } from 'react'
import { LocateFixed, MapPin } from 'lucide-react'

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Textarea, toast } from '@avdan/ui'

import { useMyHub, useUpdateMyHub } from '../hooks/use-my-hub'

/** The hub fills in where it is: an address, a free-text description for riders ("blue gate,
 *  beside the pharmacy") and a map position, taken from this device or looked up from the address. */
export function HubDetailsCard() {
  const { data: hub, isLoading, isError } = useMyHub()
  const { mutate: save, isPending } = useUpdateMyHub()

  const [address, setAddress] = useState('')
  const [description, setDescription] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (!hub) return
    setAddress(hub.address ?? '')
    setDescription(hub.description ?? '')
    setCoords(hub.lat !== null && hub.lng !== null ? { lat: hub.lat, lng: hub.lng } : null)
  }, [hub])

  function shareDeviceLocation() {
    if (!navigator.geolocation) {
      toast.error('This browser cannot share its location. Enter the address instead.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setLocating(false)
        toast.error('Could not get your location. Allow location access, or enter the address instead.')
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    )
  }

  function handleSave() {
    save({
      address: address.trim(),
      description: description.trim(),
      // Only send coordinates that changed; otherwise the address is looked up on the server.
      ...(coords && (coords.lat !== hub?.lat || coords.lng !== hub?.lng) ? coords : {}),
    })
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-base">Hub location</CardTitle>
        <CardDescription>
          Where {hub?.name ?? 'your hub'} is, so riders and the AVDAN team can find it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : isError || !hub ? (
          <p className="text-sm text-muted-foreground">
            Your account is not linked to a hub yet. Ask your administrator to assign one.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="hub-address">Address</Label>
              <Input
                id="hub-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 12 Allen Avenue, Ikeja, Lagos"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hub-description">Description</Label>
              <Textarea
                id="hub-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Landmarks and directions, e.g. blue gate beside the pharmacy, ask for Tunde"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={shareDeviceLocation} disabled={locating}>
                <LocateFixed className="mr-2 h-4 w-4" />
                {locating ? 'Locating…' : 'Use my current location'}
              </Button>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {coords
                  ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                  : 'No map position yet. It will be looked up from the address when you save.'}
              </span>
            </div>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save hub details'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
