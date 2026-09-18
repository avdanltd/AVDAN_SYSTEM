'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

/**
 * Wraps `next-themes` with AVDAN's own contract: `data-theme` on `<html>` (matches the
 * `[data-theme="dark"]` / `[data-theme="light"]` selectors already in tokens.css), light as the
 * true default rather than following the OS — a commerce brand should look the same to every new
 * visitor regardless of their system setting, the way Amazon/Jumia do, with dark as an opt-in the
 * visitor can pick and have remembered (`enableSystem` off, so a saved choice is never silently
 * overridden by an OS-level preference change).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
