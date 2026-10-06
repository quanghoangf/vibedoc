import type { Metadata } from 'next'
import {
  Atkinson_Hyperlegible, DM_Mono, DM_Sans, Geist, Geist_Mono,
  IBM_Plex_Mono, IBM_Plex_Sans, Inter, JetBrains_Mono,
} from 'next/font/google'
import { cookies } from 'next/headers'
import { DEFAULT_SETTINGS } from '@/lib/settings'
import { LANG_COOKIE, parseLang } from '@/lib/i18n'
import { LanguageProvider } from '@/context/LanguageContext'
import './globals.css'

// Every choice in Settings → Appearance → Font. Only the defaults are preloaded;
// the browser downloads the others only once their data-font-* selector is active.
// Vietnamese letters (R078) wherever Google has them; Atkinson, DM Sans and DM Mono don't (`noVietnamese` in settings.ts).
const geist = Geist({ subsets: ['latin', 'vietnamese'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin', 'vietnamese'], variable: '--font-geist-mono' })
const inter = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-inter', preload: false })
const plexSans = IBM_Plex_Sans({ subsets: ['latin', 'vietnamese'], variable: '--font-ibm-plex-sans', preload: false })
const atkinson = Atkinson_Hyperlegible({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-atkinson', preload: false })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', preload: false })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin', 'vietnamese'], variable: '--font-jetbrains-mono', preload: false })
const plexMono = IBM_Plex_Mono({ subsets: ['latin', 'vietnamese'], weight: ['400', '500'], variable: '--font-ibm-plex-mono', preload: false })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-dm-mono', preload: false })

const fontVars = [geist, geistMono, inter, plexSans, atkinson, dmSans, jetbrainsMono, plexMono, dmMono]
  .map((f) => f.variable)
  .join(' ')

export const metadata: Metadata = {
  title: 'VibeDoc',
  description: 'Project intelligence for AI-assisted development',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The UI language is a per-browser cookie (R078): read here so <html lang> and the first paint match it
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value)
  return (
    <html
      lang={lang}
      className={`dark ${fontVars}`}
      data-font-sans={DEFAULT_SETTINGS.fontSans}
      data-font-mono={DEFAULT_SETTINGS.fontMono}
    >
      <body className="bg-bg text-txt min-h-screen"><LanguageProvider initial={lang}>{children}</LanguageProvider></body>
    </html>
  )
}
