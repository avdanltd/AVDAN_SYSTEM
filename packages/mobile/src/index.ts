/**
 * @avdan/mobile — the shared React Native layer for every AVDAN mobile app.
 *
 * `packages/ui` cannot serve this purpose: it is Tailwind + Shadcn and none of it runs in React
 * Native. This package is the RN equivalent — design tokens, themed primitives, the brand mark,
 * the HTTP client, and the auth module.
 *
 * What deliberately stays in each app:
 *  - status label maps  (`constants/status.ts`) — the same state reads differently per role
 *  - the login form      — different copy, different hero
 *  - anything domain-specific (rider dispatch, vendor catalog, ...)
 */

/* ── Theme ────────────────────────────────────────────────────────────────── */
export {
  brandColors,
  createStatusLabel,
  darkColors,
  fonts,
  lightColors,
  palettes,
  radius,
  shadowCard,
  shadowModal,
  spacing,
  statusColors,
  type ColorScheme,
  type Palette,
} from './theme/tokens'
export { ThemeProvider, useTheme, type ThemePreference } from './theme/context'

/* ── Components ───────────────────────────────────────────────────────────── */
export {
  Badge,
  BrandLoader,
  Button,
  Card,
  EmptyState,
  InfoRow,
  SectionTitle,
  Skeleton,
  Spinner,
} from './components/ui'
export { AvdanLogo, AvdanMark } from './components/brand-logo'

/* ── Lib ──────────────────────────────────────────────────────────────────── */
export { ApiClientError, apiClient, configureApiClient, getApiUrl } from './lib/api-client'
export { secureStorage } from './lib/secure-storage'
export { guessImageMime, uploadImage, type UploadPrefix, type UploadResult } from './lib/uploads'
export { toast } from './lib/toast'
export { toastConfig } from './lib/toast-config'
export {
  formatDateTime,
  formatKobo,
  formatRelative,
  initials,
  isToday,
  orderRef,
} from './lib/format'

/* ── Auth ─────────────────────────────────────────────────────────────────── */
export { authService, type LoginPayload, type LoginResponse, type User } from './auth/services/auth.service'
export { useAuthStore } from './auth/store/auth.store'
export { useLogin } from './auth/hooks/use-login'
export { useLogout } from './auth/hooks/use-logout'
export { useSession } from './auth/hooks/use-session'
export { useUpdateProfile } from './auth/hooks/use-update-profile'
export { loginSchema, type LoginFormValues } from './auth/schemas/auth.schemas'
