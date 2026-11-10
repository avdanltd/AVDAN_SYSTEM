'use client'

import { lgasForState, NIGERIA_COUNTRY, NIGERIA_STATES, type AddressValue } from '@avdan/types'

import { Input } from '../primitives/input'
import { Label } from '../primitives/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

interface AddressFieldsProps {
  value: AddressValue
  onChange: (next: AddressValue) => void
  disabled?: boolean
  /** Prefix for input ids, so two forms on one page don't collide. */
  idPrefix?: string
}

/** Street, town/city, country, state, local government and landmark — one box each, so the
 *  address is searchable and routable instead of a single block of free text. Nigeria only for now. */
export function AddressFields({ value, onChange, disabled, idPrefix = 'addr' }: AddressFieldsProps) {
  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch })
  const lgas = lgasForState(value.state)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-street`}>Street number and name</Label>
        <Input
          id={`${idPrefix}-street`}
          value={value.street}
          disabled={disabled}
          maxLength={200}
          autoComplete="address-line1"
          placeholder="e.g. 12 Adeola Odeku Street"
          onChange={(e) => set({ street: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-city`}>Town / City</Label>
        <Input
          id={`${idPrefix}-city`}
          value={value.city}
          disabled={disabled}
          maxLength={100}
          autoComplete="address-level2"
          placeholder="e.g. Sango-Ota"
          onChange={(e) => set({ city: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-country`}>Country</Label>
        <Select value={NIGERIA_COUNTRY} disabled={disabled}>
          <SelectTrigger id={`${idPrefix}-country`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NIGERIA_COUNTRY}>{NIGERIA_COUNTRY}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-state`}>State</Label>
          <Select
            value={value.state}
            disabled={disabled}
            onValueChange={(state) => set({ state, lga: '' })}
          >
            <SelectTrigger id={`${idPrefix}-state`}>
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {NIGERIA_STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-lga`}>Local government</Label>
          <Select
            // Remount when the state changes so a stale LGA label never lingers.
            key={value.state}
            value={value.lga}
            disabled={disabled || !value.state}
            onValueChange={(lga) => set({ lga })}
          >
            <SelectTrigger id={`${idPrefix}-lga`}>
              <SelectValue placeholder={value.state ? 'Select local government' : 'Select a state first'} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {lgas.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-landmark`}>Landmark (optional)</Label>
        <Input
          id={`${idPrefix}-landmark`}
          value={value.landmark}
          disabled={disabled}
          maxLength={200}
          placeholder="e.g. Opposite the market"
          onChange={(e) => set({ landmark: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Optional, but it helps with better routing.</p>
      </div>
    </div>
  )
}
