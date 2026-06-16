export interface PlatformConfig {
  commission_rate: number
  delivery_fee_base_kobo: number
  delivery_fee_per_km_kobo: number
  max_delivery_radius_km: number
  escrow_release_hours: number
}

export interface AuditLogEntry {
  id: string
  admin_id: string
  action: string
  resource: string
  resource_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}
