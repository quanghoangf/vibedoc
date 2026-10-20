/**
 * The core calls a worker loop needs (src/lib/worker-runs.ts), shared by POST /api/workers (start) and
 * POST /api/workers/answer (T558, resume). Not a route: Next only serves route.ts.
 */
import path from 'path'
import { appendWorkerLog, claimNextTask, getTask, listChats, openWorkerLog, readProjectSettings, readWorkerLog, readWorkerStates, saveChat, writeWorkerState, type WorkerSettings } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { workerArgs, workerEnv } from '@/lib/worker-args'
import { isAlive, liveWorkerIds, reserveWorker, startWorker, type WorkerChat, type WorkerDeps } from '@/lib/worker-runs'

export function workerDeps(root: string, chat: WorkerChat, origin: string, workers: WorkerSettings): WorkerDeps {
  const epicId = chat.worker.target.id
  const owner = `worker-${chat.id}`
  return {
    claim: async () => {
      const { result, task, previousStatus } = await claimNextTask(epicId, root, owner)
      if (task) emitUpdate('task_updated', { taskId: task.id, status: task.status, previousStatus, task })
      return result
    },
    taskStatus: async (taskId) => (await getTask(taskId, root)).status,
    args: (taskId, resume) => workerArgs({
      taskId, mainRoot: root, mcpOrigin: origin, workerId: chat.id, resume,
      // VibeDoc's own plugin, read from the package like readPlanningSkill()
      pluginDir: path.join(process.cwd(), 'plugin'),
      allowed: workers.allowedTools,
      maxTurns: workers.maxTurnsPerTask,
    }),
    // T557: a minimal env, so VibeDoc's tokens never reach the agent; PORT = its own dev server port (T559)
    env: { ...workerEnv(process.env, workers.env), ...(chat.worker.port && { PORT: String(chat.worker.port) }) },
    save: saveWorkerChat(root),
    budget: { maxTurns: workers.maxTurnsPerTask, timeoutMin: workers.taskTimeoutMin },
    openLog: () => openWorkerLog(root, chat.id),
    readLog: (offset) => readWorkerLog(root, chat.id, offset),
    appendLog: (text) => appendWorkerLog(root, chat.id, text),
    writeState: (state) => writeWorkerState(root, state),
  }
}

/**
 * T556 + T567: picks up this project's workers that a restart left without a loop (none in memory). A `running` one
 * follows its last turn's process (core's state file): alive → its log, then the loop goes on; gone → the log is folded
 * (finished → next task; died without a result → interrupted, waits for Resume). One whose turn had ended goes on with
 * the loop. A `paused` one sleeps until its saved `retryAt`, then goes on. Idempotent: `reserveWorker` skips a live one.
 * Resolves once each worker whose process is already gone is folded and on its next step (fast), so a page that loads
 * the chats right after sees it settled (e.g. interrupted); live and paused ones go on in the background.
 */
// ponytail: runs on GET /api/conversations (every page loads it) and on a worker's own MCP call, not at boot; a startup hook if nobody opens VibeDoc
export async function adoptWorkers(root: string, origin: string): Promise<void> {
  const live = liveWorkerIds(root)
  const orphans = (await listChats(root) as WorkerChat[]).filter(c => (c.worker?.phase === 'paused' || c.worker?.phase === 'running') && !live.has(c.id))
  if (!orphans.length) return
  const [{ workers }, states] = await Promise.all([readProjectSettings(root), readWorkerStates(root)])
  const settling: Promise<void>[] = []
  for (const chat of orphans) {
    const state = chat.worker.phase === 'running' ? states.find(s => s.id === chat.id) : undefined
    const last = chat.worker.turns[chat.worker.turns.length - 1]
    // the state file is this turn's (a turn's start time is its id); an older one has nothing to follow
    const adopt = state && last && state.startedAt === last.startedAt && !state.endedAt ? state : undefined
    if (reserveWorker(root, chat.id, chat.worker.target.id, workers.maxRunning, chat.worker.port)) continue
    const started = startWorker(root, chat, workerDeps(root, chat, origin, workers), undefined, adopt)
    if (adopt && !isAlive(adopt.pid)) settling.push(started)
  }
  await Promise.all(settling)
}

export const saveWorkerChat = (root: string) => async (c: WorkerChat) => {
  await saveChat(c, root)
  emitUpdate('worker_updated', { id: c.id, phase: c.worker.phase, worker: c.worker })
  emitUpdate('chat_saved', { id: c.id })
}
