import { NextRequest, NextResponse } from 'next/server'
import { createTask, getRoadmapItem, RoadmapError, setTaskEpic, type CreateTaskParams } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/**
 * JSON `CreateTaskParams` (+ `epic`), or multipart (T512): a `task` field with that JSON and `image` files,
 * written under plans/tasks/assets/<id>/ and linked in the description.
 */
export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  const root = rootOf(req)
  try {
    let body: CreateTaskParams & { epic?: string }
    let images: Uint8Array[] = []
    if (req.headers.get('content-type')?.startsWith('multipart/form-data')) {
      const form = await req.formData()
      body = JSON.parse(String(form.get('task') ?? '{}'))
      const files = form.getAll('image').filter((f): f is File => typeof f !== 'string')
      if (files.length && isPlayground()) return playgroundForbidden()
      images = await Promise.all(files.map(async f => new Uint8Array(await f.arrayBuffer())))
    } else {
      body = await req.json()
    }
    if (typeof body?.title !== 'string' || !body.title.trim()) throw new RoadmapError('Title is required')

    // An epic is checked before anything is written; its **Tasks:** line is linked after the create
    const epic = body.epic ? await getRoadmapItem(body.epic, root).catch(() => null) : null
    if (body.epic && (!epic || !epic.parent)) throw new RoadmapError(`Epic not found: ${body.epic}`)
    let task = await createTask({ ...body, ...(epic && { phase: `${epic.id} — ${epic.title}` }), images }, root)
    if (epic) task = await setTaskEpic(task.id, epic.id, root)
    emitUpdate('task_created', { task })
    if (epic) emitUpdate('roadmap_updated', { id: epic.id })
    return NextResponse.json({ task }, { status: 201 })
  } catch (e) {
    if (e instanceof SyntaxError) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    return errorResponse(e)
  }
}
