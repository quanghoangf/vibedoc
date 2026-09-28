import { NextRequest, NextResponse } from 'next/server'
import { readActivity, getConfiguredRoot } from '@/lib/core'
import { groupSessions, sessionsForTask } from '@/lib/sessions'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const root = params.get('root') || getConfiguredRoot()
  const taskId = params.get('taskId')
  const limit = parseInt(params.get('limit') || '') || undefined
  let sessions = groupSessions(await readActivity(root, 2000))
  if (taskId) sessions = sessionsForTask(sessions, taskId)
  return NextResponse.json(limit ? sessions.slice(0, limit) : sessions)
}
