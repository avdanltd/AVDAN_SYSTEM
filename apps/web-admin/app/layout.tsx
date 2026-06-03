import type { Metadata } from 'next'
import { Bricolage_Grotesque, Playfair_Display } from 'next/font/google'
import { cookies } from 'next/headers'

import { Providers } from './providers'
import type { User } from '@/modules/auth/services/auth.service'
import '@/styles/globals.css'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AVDAN Admin',
  description: 'AVDAN platform administration',
}

async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('avdan_token')?.value
  if (!token) return null

  try {
    const res = await fetch(`${process.env.API_INTERNAL_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json() as Promise<User>
  } catch {
    return null
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()

  return (
    <html lang="en" className={`${bricolage.variable} ${playfair.variable}`}>
      <body>
        <Providers user={user}>{children}</Providers>
      </body>
    </html>
  )
}
