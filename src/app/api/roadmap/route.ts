import { NextRequest, NextResponse } from 'next/server'
import { listRoadmap } from '@/lib/core'
import { errorResponse, rootOf } from './_shared'

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await listRoadmap(rootOf(req)))
  } catch (e) {
    return errorResponse(e)
  }
}
