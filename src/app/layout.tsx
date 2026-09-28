import type { Metadata } from 'next'
import {
  Atkinson_Hyperlegible, DM_Mono, DM_Sans, Geist, Geist_Mono,
  IBM_Plex_Mono, IBM_Plex_Sans, Inter, JetBrains_Mono,
} from 'next/font/google'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import './globals.css'

// Every choice in Settings → Appearance → Font. Only the defaults are preloaded;
// the browser downloads the others only once their data-font-* selector is active.
const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', preload: false })
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], variable: '--font-ibm-plex-sans', preload: false })
const atkinson = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-atkinson', preload: false })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', preload: false })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', preload: false })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-ibm-plex-mono', preload: false })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-dm-mono', preload: false })

const fontVars = [geist, geistMono, inter, plexSans, atkinson, dmSans, jetbrainsMono, plexMono, dmMono]
  .map((f) => f.variable)
  .join(' ')

export const metadata: Metadata = {
  title: 'VibeDoc',
  description: 'Project intelligence for AI-assisted development',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${fontVars}`}
      data-font-sans={DEFAULT_SETTINGS.fontSans}
      data-font-mono={DEFAULT_SETTINGS.fontMono}
    >
      <body className="bg-bg text-txt min-h-screen">{children}</body>
    </html>
  )
}
