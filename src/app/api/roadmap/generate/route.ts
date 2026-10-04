import { NextRequest, NextResponse } from 'next/server'
import { generateRoadmap } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { errorResponse, rootOf } from '../_shared'
import { isDemo, demoForbidden } from '@/lib/demo'

export async function POST(req: NextRequest) {
  if (isDemo()) return demoForbidden()
  try {
    const result = await generateRoadmap(rootOf(req))
    emitUpdate('roadmap_updated', { kind: 'generate', source: result.source })
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}
