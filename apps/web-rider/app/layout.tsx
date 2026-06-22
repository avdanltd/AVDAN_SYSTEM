import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'AVDAN Rider',
  description: 'Delivery rider portal',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
