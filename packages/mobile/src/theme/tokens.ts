/**
 * AVDAN design tokens, shared by every React Native app.
 *
 * Colour values are taken from the real brand mark (`apps/api/static/logo.png`):
 *   badge blue gradient  #3062D2 -> #0A2480   (deep navy core #0D2E94)
 *   arrow gold gradient  #FAD96B -> #F28614
 * The web token set (`packages/ui/src/tokens/tokens.css`) uses #135BEC / #F59F0A, which sit
 * inside those ranges — the two systems agree, this file just names the endpoints too so the
 * gradients in the logo can be reproduced in-app.
 */

export type ColorScheme = 'light' | 'dark'

const brand = {
  /** Primary action blue — matches --primary in tokens.css. */
  primary: '#135bec',
  primaryDark: '#0d2e94',
  primaryLight: '#3062d2',
  /** Deepest navy in the badge gradient. */
  navy: '#0a2480',
  /** Signal Orange accent — matches --brand-accent in tokens.css. */
  accent: '#f59f0a',
  accentTop: '#fad96b',
  accentBottom: '#f28614',
} as const

export const lightColors = {
  background: '#ffffff',
  backgroundElevated: '#f8fafc',
  foreground: '#0a1229',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  subtleForeground: '#94a3b8',
  primary: brand.primary,
  primaryForeground: '#ffffff',
  primaryMuted: '#eff4fe',
  border: '#e2e8f0',
  destructive: '#e11d48',
  destructiveForeground: '#ffffff',
  destructiveMuted: '#fef1f3',
  success: '#16a34a',
  successForeground: '#ffffff',
  successMuted: '#e8fbf0',
  warning: '#f59f0a',
  warningMuted: '#fef6e7',
  accent: brand.accent,
  accentForeground: '#0a1229',
  overlay: 'rgba(10, 18, 41, 0.45)',
  skeleton: '#eef2f7',
}

/** Every palette key resolves to a colour string; `as const` here would pin each key to a
 *  single literal hex and make the dark palette unassignable. */
export type Palette = Record<keyof typeof lightColors, string>

export const darkColors: Palette = {
  background: '#080d1c',
  backgroundElevated: '#0e1730',
  foreground: '#eef2fb',
  card: '#111c38',
  cardBorder: '#1e2c50',
  muted: '#16223f',
  mutedForeground: '#94a3c4',
  subtleForeground: '#6b7ba3',
  // Lifted from #135bec so it keeps contrast against the dark ground.
  primary: '#4d86ff',
  primaryForeground: '#04122e',
  primaryMuted: '#132648',
  border: '#1e2c50',
  destructive: '#fb7185',
  destructiveForeground: '#2a0710',
  destructiveMuted: '#31121b',
  success: '#4ade80',
  successForeground: '#052e16',
  successMuted: '#12301f',
  warning: '#fbbf24',
  warningMuted: '#33260c',
  accent: '#fbbf24',
  accentForeground: '#2a1a02',
  overlay: 'rgba(2, 6, 18, 0.65)',
  skeleton: '#16223f',
}

export const palettes: Record<ColorScheme, Palette> = {
  light: lightColors,
  dark: darkColors,
}

/** Brand constants that do NOT flip with the colour scheme (the logo is the logo). */
export const brandColors = brand

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const

// Keys must match the font names @expo-google-fonts/* registers via useFonts() in _layout.tsx.
export const fonts = {
  sans: 'BricolageGrotesque_400Regular',
  sansMedium: 'BricolageGrotesque_500Medium',
  sansSemiBold: 'BricolageGrotesque_600SemiBold',
  sansBold: 'BricolageGrotesque_700Bold',
  display: 'PlayfairDisplay_700Bold',
  displaySemiBold: 'PlayfairDisplay_600SemiBold',
  displayItalic: 'PlayfairDisplay_700Bold_Italic',
} as const

/** Elevation. Dark mode leans on borders + surface lift rather than shadow, which reads as mud. */
export function shadowCard(scheme: ColorScheme) {
  if (scheme === 'dark') {
    return {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 14,
      elevation: 4,
    } as const
  }
  return {
    shadowColor: '#0a1229',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  } as const
}

export function shadowModal(scheme: ColorScheme) {
  if (scheme === 'dark') {
    return {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.55,
      shadowRadius: 40,
      elevation: 12,
    } as const
  }
  return {
    shadowColor: '#0a1229',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 8,
  } as const
}

type StatusTone = { bg: string; fg: string }

/**
 * Status chip colours, resolved per scheme. Covers the FULL order state machine, not one role's
 * subset — a shared package cannot know which statuses a given app will render, and an unmapped
 * status falls back to flat muted grey, which reads as "no status" rather than as information.
 */
export function statusColors(scheme: ColorScheme): Record<string, StatusTone> {
  const c = palettes[scheme]
  const isDark = scheme === 'dark'
  const tone = (light: StatusTone, dark: StatusTone) => (isDark ? dark : light)

  return {
    PENDING: tone({ bg: c.muted, fg: c.mutedForeground }, { bg: c.muted, fg: c.mutedForeground }),
    PAID: tone({ bg: c.warningMuted, fg: '#92400e' }, { bg: c.warningMuted, fg: c.warning }),
    VENDOR_ACCEPTED: tone({ bg: '#dbeafe', fg: '#1e40af' }, { bg: '#152a54', fg: '#93b4ff' }),
    PREPARING: tone({ bg: '#ede9fe', fg: '#5b21b6' }, { bg: '#251a4d', fg: '#c4b5fd' }),
    VENDOR_REJECTED: tone({ bg: '#fee2e2', fg: '#991b1b' }, { bg: '#3a1218', fg: '#fca5a5' }),
    VENDOR_REMEDIATION: tone({ bg: '#ffedd5', fg: '#9a3412' }, { bg: '#3a220f', fg: '#fdba74' }),
    REFUND_INITIATED: tone({ bg: c.muted, fg: c.mutedForeground }, { bg: c.muted, fg: c.mutedForeground }),
    READY_FOR_PICKUP: tone({ bg: '#dbeafe', fg: '#1e40af' }, { bg: '#152a54', fg: '#93b4ff' }),
    PICKED_UP: tone({ bg: '#ede9fe', fg: '#5b21b6' }, { bg: '#251a4d', fg: '#c4b5fd' }),
    IN_TRANSIT_TO_HUB: tone({ bg: '#ffedd5', fg: '#9a3412' }, { bg: '#3a220f', fg: '#fdba74' }),
    AT_HUB: tone({ bg: '#e0f2fe', fg: '#075985' }, { bg: '#0c2a3d', fg: '#7dd3fc' }),
    QA_IN_PROGRESS: tone({ bg: '#e0f2fe', fg: '#075985' }, { bg: '#0c2a3d', fg: '#7dd3fc' }),
    QA_PASSED: tone({ bg: c.successMuted, fg: '#166534' }, { bg: c.successMuted, fg: c.success }),
    QA_FAILED: tone({ bg: '#fee2e2', fg: '#991b1b' }, { bg: '#3a1218', fg: '#fca5a5' }),
    OUT_FOR_DELIVERY: tone({ bg: c.warningMuted, fg: '#92400e' }, { bg: c.warningMuted, fg: c.warning }),
    DELIVERED: tone({ bg: c.successMuted, fg: '#166534' }, { bg: c.successMuted, fg: c.success }),
    FAILED_DELIVERY: tone({ bg: '#fee2e2', fg: '#991b1b' }, { bg: '#3a1218', fg: '#fca5a5' }),
    PAYMENT_RELEASE_PENDING: tone({ bg: c.muted, fg: c.mutedForeground }, { bg: c.muted, fg: c.mutedForeground }),
    PAYMENT_RELEASED: tone({ bg: c.successMuted, fg: '#166534' }, { bg: c.successMuted, fg: c.success }),
    COMPLETED: tone({ bg: c.successMuted, fg: '#166534' }, { bg: c.successMuted, fg: c.success }),
    DISPUTED: tone({ bg: '#fee2e2', fg: '#991b1b' }, { bg: '#3a1218', fg: '#fca5a5' }),
    DISPUTE_RESOLVED: tone({ bg: c.muted, fg: c.mutedForeground }, { bg: c.muted, fg: c.mutedForeground }),
    CANCELLED: tone({ bg: c.muted, fg: c.mutedForeground }, { bg: c.muted, fg: c.mutedForeground }),
  }
}

/**
 * Build a status-label function from a per-app override map.
 *
 * Wording is deliberately NOT shared: the same state means different things to different roles.
 * PAYMENT_RELEASE_PENDING is "Delivered" to the rider who dropped off the parcel and "Payout
 * pending" to the vendor waiting to be paid. Each app owns its own map (see
 * `constants/status.ts`) and passes it here.
 */
export function createStatusLabel(
  overrides: Record<string, string> = {},
): (status: string) => string {
  return (status: string): string => {
    const override = overrides[status]
    if (override) return override
    return status
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ')
  }
}
