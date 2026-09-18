// Matches the real shape stored/read by AnalyticsService.get_config/update_config
// (apps/api/services/analytics/models.py's DEFAULT_PLATFORM_CONFIG) — the previous version of
// this type used field names (`commission_rate`, `delivery_fee_base_kobo`,
// `delivery_fee_per_km_kobo`, `max_delivery_radius_km`) that don't exist in the backend config
// dict at all, so the form always silently fell back to its own hardcoded defaults and every
// save was a no-op.
export interface PlatformConfig {
  commission_rate_percent: number
  delivery_fee_structure: {
    base_fee_kobo: number
    per_km_kobo: number
  }
  escrow_release_hours: number
  order_cancellation_window_minutes: number
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
