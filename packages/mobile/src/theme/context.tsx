import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme as useSystemColorScheme } from 'react-native'
import * as SecureStore from 'expo-secure-store'

import {
  palettes,
  radius,
  shadowCard,
  shadowModal,
  spacing,
  statusColors,
  type ColorScheme,
  type Palette,
} from './tokens'

/** What the user picked. 'system' defers to the OS. */
export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'avdan_theme_preference'

interface ThemeValue {
  /** The resolved scheme actually being rendered. */
  scheme: ColorScheme
  /** The user's stored preference, which may be 'system'. */
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  colors: Palette
  spacing: typeof spacing
  radius: typeof radius
  shadowCard: ReturnType<typeof shadowCard>
  shadowModal: ReturnType<typeof shadowModal>
  statusColors: ReturnType<typeof statusColors>
  isDark: boolean
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useSystemColorScheme()
  const [preference, setPreferenceState] = useState<ThemePreference>('system')

  // Restore the saved preference. SecureStore is already a dependency for tokens, so we
  // reuse it rather than pulling in AsyncStorage just for this.
  useEffect(() => {
    let cancelled = false
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((v) => {
        if (!cancelled && (v === 'light' || v === 'dark' || v === 'system')) {
          setPreferenceState(v)
        }
      })
      .catch(() => {
        // A read failure just means we stay on 'system' — not worth surfacing.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p)
    SecureStore.setItemAsync(STORAGE_KEY, p).catch(() => {
      // Persisting is best-effort; the in-memory choice still applies for this session.
    })
  }, [])

  const scheme: ColorScheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      preference,
      setPreference,
      colors: palettes[scheme],
      spacing,
      radius,
      shadowCard: shadowCard(scheme),
      shadowModal: shadowModal(scheme),
      statusColors: statusColors(scheme),
      isDark: scheme === 'dark',
    }),
    [scheme, preference, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
