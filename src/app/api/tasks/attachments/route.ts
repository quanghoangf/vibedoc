import { NextRequest, NextResponse } from 'next/server'
import { saveTaskAttachment } from '@/lib/core'
import { ATTACHMENTS_DIR } from '@/lib/attachments'
import { emitUpdate } from '@/lib/events'
import { isDemo, demoForbidden, isPlayground, playgroundForbidden } from '@/lib/demo'
import { errorResponse, rootOf } from '../../roadmap/_shared'

/**
 * T512: images of a draft task handed to the agent ("Start with agent"), before the task exists.
 * Multipart `image` files → plans/tasks/assets/draft-<stamp>/<n>.<ext>; returns their project paths and task-relative links.
 */
// ponytail: the agent's task keeps linking the draft folder; moving it to assets/<id>/ on Accept is a follow-up.
export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  if (isPlayground()) return playgroundForbidden()
  try {
    const form = await req.formData()
    const files = form.getAll('image').filter((f): f is File => typeof f !== 'string')
    const folder = `draft-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const links: string[] = []
    for (const f of files) links.push(await saveTaskAttachment(folder, new Uint8Array(await f.arrayBuffer()), rootOf(req)))
    const paths = links.map(l => `${ATTACHMENTS_DIR}/${l.replace(/^assets\//, '')}`)
    emitUpdate('task_updated', { attachments: paths })
    return NextResponse.json({ links, paths })
  } catch (e) {
    return errorResponse(e)
  }
}
