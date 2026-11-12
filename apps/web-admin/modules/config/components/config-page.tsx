'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Button,
  Skeleton,
  Badge,
  ConfirmDialog,
  Switch,
  Input as TextInput,
} from '@avdan/ui'
import { usePlatformConfig } from '../hooks/use-platform-config'
import { useUpdateConfig } from '../hooks/use-update-config'
import { useAuditLog } from '../hooks/use-audit-log'
import { formatDate } from '@/lib/format'
import type { DeliveryPromo } from '../types'

const DEFAULT_PROMO: DeliveryPromo = { enabled: false, percent: 10, label: 'Launch offer', ends_at: null }

/** ISO → the value a <input type="datetime-local"> wants (viewer's local time). */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Delivery-fee promotion: switch a percentage off the delivery fee on/off, with an optional end
 * date. AVDAN funds it from its own delivery cut — the rider's share is still worked out on the
 * full fee — and special/bulky charges are never discounted.
 */
function PromotionsCard() {
  const { data: config } = usePlatformConfig()
  const { mutate: updateConfig, isPending } = useUpdateConfig()
  const saved = config?.delivery_promo ?? DEFAULT_PROMO
  const [promo, setPromo] = useState<DeliveryPromo>(saved)
  const [endsLocal, setEndsLocal] = useState('')

  useEffect(() => {
    setPromo(saved)
    setEndsLocal(toLocalInput(saved.ends_at))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.delivery_promo])

  const commission = config?.delivery_commission_percent ?? 20
  const percentValid = promo.percent >= 0 && promo.percent <= 100

  function save(next: DeliveryPromo) {
    const ends = endsLocal ? new Date(endsLocal).toISOString() : null
    updateConfig({ delivery_promo: { ...next, ends_at: ends } })
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="font-display">Promotions</CardTitle>
        <CardDescription>
          Delivery-fee discount shown to every customer at checkout. Switch it off any time.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {promo.enabled ? 'Promotion is ON' : 'Promotion is OFF'}
            </p>
            <p className="text-xs text-muted-foreground">
              {promo.enabled ? 'New orders get the discount.' : 'Customers pay the normal delivery fee.'}
            </p>
          </div>
          <Switch
            checked={promo.enabled}
            disabled={isPending || !percentValid}
            onCheckedChange={(enabled) => {
              const next = { ...promo, enabled }
              setPromo(next)
              save(next)
            }}
            aria-label="Delivery discount promotion on or off"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Discount on delivery fee (%)
            <TextInput
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={promo.percent}
              onChange={(e) => setPromo({ ...promo, percent: Number(e.target.value) })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Label customers see
            <TextInput
              maxLength={60}
              value={promo.label}
              onChange={(e) => setPromo({ ...promo, label: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Ends (optional)
            <TextInput type="datetime-local" value={endsLocal} onChange={(e) => setEndsLocal(e.target.value)} />
          </label>
        </div>

        <p className="text-xs text-muted-foreground">
          With the usual {commission}% delivery commission, a {promo.percent}% discount leaves AVDAN{' '}
          {Math.max(commission - promo.percent, 0)}% of the delivery fee and the rider keeps their normal{' '}
          {100 - commission}%. Special charges for bulky products are not discounted. Leave the end date
          empty to run until you switch it off; it stops by itself at the end time.
        </p>

        <div>
          <Button type="button" disabled={isPending || !percentValid} onClick={() => save(promo)}>
            {isPending ? 'Saving…' : 'Save promotion'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

const configSchema = z.object({
  commission_rate_percent: z.coerce.number().min(0).max(100),
  delivery_commission_percent: z.coerce.number().min(0).max(100),
  base_fee_kobo: z.coerce.number().min(0),
  per_km_kobo: z.coerce.number().min(0),
  road_factor: z.coerce.number().min(1).max(3),
  min_withdrawal_kobo: z.coerce.number().min(0),
  min_order_kobo: z.coerce.number().min(0),
  eta_avg_speed_kmh: z.coerce.number().min(5).max(80),
  escrow_release_hours: z.coerce.number().min(1),
  order_cancellation_window_minutes: z.coerce.number().min(0),
})

type ConfigFormValues = z.infer<typeof configSchema>

export function ConfigPage() {
  const { data: config, isLoading, isError: configError, refetch: refetchConfig } = usePlatformConfig()
  const { mutate: updateConfig, isPending: saving } = useUpdateConfig()
  const {
    data: auditLog,
    isError: auditError,
    refetch: refetchAuditLog,
  } = useAuditLog({ page: '1', page_size: '20' })
  const [pendingValues, setPendingValues] = useState<ConfigFormValues | null>(null)

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      commission_rate_percent: 0,
      delivery_commission_percent: 20,
      base_fee_kobo: 0,
      per_km_kobo: 0,
      road_factor: 1.3,
      min_withdrawal_kobo: 100000,
      min_order_kobo: 0,
      escrow_release_hours: 48,
      order_cancellation_window_minutes: 30,
    },
  })

  useEffect(() => {
    if (config) {
      form.reset({
        commission_rate_percent: config.commission_rate_percent,
        delivery_commission_percent: config.delivery_commission_percent ?? 20,
        base_fee_kobo: config.delivery_fee_structure.base_fee_kobo,
        per_km_kobo: config.delivery_fee_structure.per_km_kobo,
        road_factor: config.delivery_fee_structure.road_factor ?? 1.3,
        min_withdrawal_kobo: config.min_withdrawal_kobo ?? 100000,
        min_order_kobo: config.min_order_kobo ?? 0,
        eta_avg_speed_kmh: config.eta_avg_speed_kmh ?? 25,
        escrow_release_hours: config.escrow_release_hours,
        order_cancellation_window_minutes: config.order_cancellation_window_minutes,
      })
    }
  }, [config, form])

  function handleSubmit(values: ConfigFormValues) {
    setPendingValues(values)
  }

  function handleConfirmSave() {
    if (!pendingValues) return
    updateConfig(
      {
        commission_rate_percent: pendingValues.commission_rate_percent,
        delivery_commission_percent: pendingValues.delivery_commission_percent,
        delivery_fee_structure: {
          base_fee_kobo: pendingValues.base_fee_kobo,
          per_km_kobo: pendingValues.per_km_kobo,
          road_factor: pendingValues.road_factor,
        },
        min_withdrawal_kobo: pendingValues.min_withdrawal_kobo,
        min_order_kobo: pendingValues.min_order_kobo,
        eta_avg_speed_kmh: pendingValues.eta_avg_speed_kmh,
        escrow_release_hours: pendingValues.escrow_release_hours,
        order_cancellation_window_minutes: pendingValues.order_cancellation_window_minutes,
      },
      { onSuccess: () => setPendingValues(null) },
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Platform Configuration</h1>
        <p className="text-sm text-muted-foreground">
          Adjust platform-wide settings. Changes take effect immediately.
        </p>
      </div>

      {/* Config Form */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Settings</CardTitle>
          <CardDescription>Commission, delivery fees, and operational parameters</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : configError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm font-medium text-destructive">
                Couldn't load platform configuration.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetchConfig()}>
                Retry
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                <FormField
                  control={form.control}
                  name="commission_rate_percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commission Rate (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" max="100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="delivery_commission_percent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Fee Commission (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" max="100" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        AVDAN's share of each delivery fee; the rider is paid the rest. Applies to orders placed after the change.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="base_fee_kobo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Delivery Fee (kobo)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="per_km_kobo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Fee per KM (kobo) — covers fuel</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="road_factor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Road Factor (× straight-line distance)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" max="3" step="0.05" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="eta_avg_speed_kmh"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Average Rider Speed for ETAs (km/h)</FormLabel>
                      <FormControl>
                        <Input type="number" min="5" max="80" step="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="min_withdrawal_kobo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Withdrawal (kobo)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="min_order_kobo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Order Value (kobo)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1000" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Smallest item subtotal a customer can check out with. 0 means no minimum.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="order_cancellation_window_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cancellation Window (minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="escrow_release_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Escrow Release Hours</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" step="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save Configuration'}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <PromotionsCard />

      {/* Audit Log */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display">Audit Log</CardTitle>
          <CardDescription>Recent admin actions on the platform</CardDescription>
        </CardHeader>
        <CardContent>
          {auditError ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm font-medium text-destructive">Couldn't load the audit log.</p>
              <Button variant="outline" size="sm" onClick={() => refetchAuditLog()}>
                Retry
              </Button>
            </div>
          ) : auditLog?.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit entries.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-border">
                {(auditLog?.items ?? []).map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {entry.action.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-sm font-medium text-foreground capitalize">
                          {entry.resource}
                        </span>
                        {entry.resource_id && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {entry.resource_id.slice(0, 12)}…
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Admin {entry.admin_id.slice(0, 8)}… · {formatDate(entry.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

      <ConfirmDialog
        open={!!pendingValues}
        onOpenChange={(open) => { if (!open) setPendingValues(null) }}
        title="Save Configuration"
        description="Platform-wide settings will change immediately for all users. Are you sure?"
        confirmLabel="Save Changes"
        loading={saving}
        onConfirm={handleConfirmSave}
      />
    </div>
  )
}
