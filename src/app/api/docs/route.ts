import { NextRequest, NextResponse } from 'next/server'
import { listDocs, readDoc, searchDocs, writeDoc, editDoc, createDoc, renameDoc, deleteDoc, getConfiguredRoot, enrichDescription, noteDocEdit, docLastEdit } from '@/lib/core'
import { emitUpdate } from '@/lib/events'

export async function GET(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const query = req.nextUrl.searchParams.get('q')
  const read = req.nextUrl.searchParams.get('read')

  if (read) {
    const doc = await readDoc(read, root)
    return NextResponse.json({ ...doc, lastEdit: await docLastEdit(root, doc.path) })
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
    const { path: docPath, content, edits, actor } = await req.json()
    // `edits` (old_string→new_string) touches only the matched spans; `content` replaces the file (editor save)
    if (Array.isArray(edits)) await editDoc(docPath, edits, root)
    else await writeDoc(docPath, content, root)
    await noteDocEdit(root, docPath, actor === 'ai' ? 'ai' : 'human')
    emitUpdate('doc_updated', { path: docPath, actor, edits })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
    const { path: docPath, content } = await req.json()
    await createDoc(docPath, content, root)
    emitUpdate('doc_created', { path: docPath })
    // Fire-and-forget: enrich description asynchronously (doesn't block response)
    if (process.env.ANTHROPIC_API_KEY) {
      enrichDescription(docPath, root).catch(() => { /* ignore enrichment failures */ })
    }
    return NextResponse.json({ ok: true, path: docPath }, { status: 201 })
  } catch (e) {
    const nodeErr = e as NodeJS.ErrnoException
    if (nodeErr.code === 'EEXIST') return NextResponse.json({ error: 'File already exists' }, { status: 409 })
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
    const { oldPath, newPath } = await req.json()
    await renameDoc(oldPath, newPath, root)
    emitUpdate('doc_renamed', { oldPath, newPath })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
    const { path: docPath } = await req.json()
    const content = await deleteDoc(docPath, root)
    emitUpdate('doc_deleted', { path: docPath })
    // content lets the client undo by re-creating the doc
    return NextResponse.json({ ok: true, content })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
