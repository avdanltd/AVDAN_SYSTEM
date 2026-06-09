'use client'

import { useEffect } from 'react'
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
} from '@avdan/ui'
import { usePlatformConfig } from '../hooks/use-platform-config'
import { useUpdateConfig } from '../hooks/use-update-config'
import { useAuditLog } from '../hooks/use-audit-log'
import { formatDate } from '@/lib/format'

const configSchema = z.object({
  commission_rate: z.coerce.number().min(0).max(100),
  delivery_fee_base_kobo: z.coerce.number().min(0),
  delivery_fee_per_km_kobo: z.coerce.number().min(0),
  max_delivery_radius_km: z.coerce.number().min(1),
  escrow_release_hours: z.coerce.number().min(1),
})

type ConfigFormValues = z.infer<typeof configSchema>

export function ConfigPage() {
  const { data: config, isLoading } = usePlatformConfig()
  const { mutate: updateConfig, isPending: saving } = useUpdateConfig()
  const { data: auditLog, isError: auditError } = useAuditLog({ page: '1', limit: '20' })

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      commission_rate: 0,
      delivery_fee_base_kobo: 0,
      delivery_fee_per_km_kobo: 0,
      max_delivery_radius_km: 10,
      escrow_release_hours: 48,
    },
  })

  useEffect(() => {
    if (config) {
      form.reset({
        commission_rate: config.commission_rate,
        delivery_fee_base_kobo: config.delivery_fee_base_kobo,
        delivery_fee_per_km_kobo: config.delivery_fee_per_km_kobo,
        max_delivery_radius_km: config.max_delivery_radius_km,
        escrow_release_hours: config.escrow_release_hours,
      })
    }
  }, [config, form])

  function handleSubmit(values: ConfigFormValues) {
    updateConfig(values)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Platform Configuration</h1>
        <p className="text-sm text-muted-foreground">
          Adjust platform-wide settings. Changes take effect immediately.
        </p>
      </div>

      {/* Config Form */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Commission, delivery fees, and operational parameters</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2"
              >
                <FormField
                  control={form.control}
                  name="commission_rate"
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
                  name="delivery_fee_base_kobo"
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
                  name="delivery_fee_per_km_kobo"
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
                  name="max_delivery_radius_km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Delivery Radius (km)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" step="1" {...field} />
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

      {/* Audit Log — only if endpoint exists */}
      {!auditError && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>Recent admin actions on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLog?.items.length === 0 ? (
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
      )}
    </div>
  )
}
