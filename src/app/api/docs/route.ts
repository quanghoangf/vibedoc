import { NextRequest, NextResponse } from 'next/server'
import { listDocs, readDoc, searchDocs, writeDoc, editDoc, createDoc, renameDoc, deleteDoc, rootFrom, enrichDescription, noteDocEdit, docLastEdit, setDocProperties, readGettingStarted } from '@/lib/core'
import { PROPERTY_KEY, parsePriority } from '@/lib/doc-priority'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function GET(req: NextRequest) {
  const root = rootFrom(req.nextUrl.searchParams.get('root'))
  const query = req.nextUrl.searchParams.get('q')
  const read = req.nextUrl.searchParams.get('read')

  // VibeDoc's own guide (/getting-started), from the package even when VIBEDOC_ROOT is another project
  if (req.nextUrl.searchParams.get('guide') === 'getting-started') {
    return NextResponse.json({ content: await readGettingStarted() })
  }
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
  if (isDemo()) return demoForbidden()
  try {
    const root = rootFrom(req.nextUrl.searchParams.get('root'))
    const { path: docPath, content, edits, actor, properties } = await req.json()
    // `properties` ({key: value | null}) rewrites only those frontmatter keys
    if (properties !== undefined) {
      if (!properties || typeof properties !== 'object' || Array.isArray(properties)) throw new Error('properties must be an object')
      for (const [k, v] of Object.entries(properties)) {
        if (!PROPERTY_KEY.test(k)) throw new Error(`"${k}" is not a property name: letters, digits, - and _, starting with a letter`)
        if (v !== null && typeof v !== 'string') throw new Error(`${k} must be text or null`)
        if (k.toLowerCase() === 'priority' && v !== null && !parsePriority(v)) throw new Error('priority must be P0, P1, P2 or P3')
      }
      await setDocProperties(docPath, properties, root)
      await noteDocEdit(root, docPath, actor === 'ai' ? 'ai' : 'human')
      emitUpdate('doc_updated', { path: docPath, actor, properties })
      return NextResponse.json({ ok: true })
    }
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
  if (isDemo()) return demoForbidden()
  try {
    const root = rootFrom(req.nextUrl.searchParams.get('root'))
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
  if (isDemo()) return demoForbidden()
  try {
    const root = rootFrom(req.nextUrl.searchParams.get('root'))
    const { oldPath, newPath } = await req.json()
    await renameDoc(oldPath, newPath, root)
    emitUpdate('doc_renamed', { oldPath, newPath })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const root = rootFrom(req.nextUrl.searchParams.get('root'))
    const { path: docPath } = await req.json()
    const content = await deleteDoc(docPath, root)
    emitUpdate('doc_deleted', { path: docPath })
    // content lets the client undo by re-creating the doc
    return NextResponse.json({ ok: true, content })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
