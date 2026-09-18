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
} from '@avdan/ui'
import { usePlatformConfig } from '../hooks/use-platform-config'
import { useUpdateConfig } from '../hooks/use-update-config'
import { useAuditLog } from '../hooks/use-audit-log'
import { formatDate } from '@/lib/format'

const configSchema = z.object({
  commission_rate_percent: z.coerce.number().min(0).max(100),
  base_fee_kobo: z.coerce.number().min(0),
  per_km_kobo: z.coerce.number().min(0),
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
      base_fee_kobo: 0,
      per_km_kobo: 0,
      escrow_release_hours: 48,
      order_cancellation_window_minutes: 30,
    },
  })

  useEffect(() => {
    if (config) {
      form.reset({
        commission_rate_percent: config.commission_rate_percent,
        base_fee_kobo: config.delivery_fee_structure.base_fee_kobo,
        per_km_kobo: config.delivery_fee_structure.per_km_kobo,
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
        delivery_fee_structure: {
          base_fee_kobo: pendingValues.base_fee_kobo,
          per_km_kobo: pendingValues.per_km_kobo,
        },
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
                      <FormLabel>Delivery Fee per KM (kobo)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="100" {...field} />
                      </FormControl>
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
