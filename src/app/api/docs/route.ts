import { NextRequest, NextResponse } from 'next/server'
import { listDocs, readDoc, searchDocs, writeDoc, getConfiguredRoot } from '@/lib/core'
import { emitUpdate } from '@/lib/events'

export async function GET(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const query = req.nextUrl.searchParams.get('q')
  const read = req.nextUrl.searchParams.get('read')

  if (read) {
    const doc = await readDoc(read, root)
    return NextResponse.json(doc)
  }
  if (query) {
    const results = await searchDocs(query, root)
    return NextResponse.json({ results })
  }
  const docs = await listDocs(root)
  return NextResponse.json(docs)
}

export async function PUT(req: NextRequest) {
  try {
    const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
    const { path: docPath, content } = await req.json()
    await writeDoc(docPath, content, root)
    emitUpdate('doc_updated', { path: docPath })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
