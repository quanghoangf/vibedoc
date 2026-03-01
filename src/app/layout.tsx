import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VibeDoc',
  description: 'Project intelligence for AI-assisted development',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-txt min-h-screen">{children}</body>
    </html>
  )
}
