import { NextRequest, NextResponse } from 'next/server'
import { createDoc, getConfiguredRoot } from '@/lib/core'
import { emitUpdate } from '@/lib/events'

interface FileToWrite {
  path: string
  content: string
  skipped?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
    const { files } = await req.json() as { files: FileToWrite[] }

    const results: { path: string; success: boolean; error?: string }[] = []

    for (const file of files) {
      if (file.skipped) continue

      try {
        await createDoc(file.path, file.content, root)
        emitUpdate('doc_created', { path: file.path })
        results.push({ path: file.path, success: true })
      } catch (e) {
        const err = e as NodeJS.ErrnoException
        if (err.code === 'EEXIST') {
          results.push({ path: file.path, success: false, error: 'already exists' })
        } else {
          results.push({ path: file.path, success: false, error: (e as Error).message })
        }
      }
    }

    return NextResponse.json({ results })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
