import { NextRequest, NextResponse } from 'next/server'
import { listDocs, readDoc, searchDocs, getConfiguredRoot } from '@/lib/core'

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
