import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import { detectFrontend, rootFrom } from '@/lib/core'
import { frontendNotes } from '@/lib/frontend'

export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const app = await detectFrontend(root)
  const vibedocPort = Number(process.env.PORT) || 3000
  const notes = app ? frontendNotes(app, vibedocPort, path.resolve(root) === process.cwd()) : []
  return NextResponse.json({ app, notes })
}
