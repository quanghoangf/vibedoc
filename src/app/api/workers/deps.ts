/**
 * The core calls a worker loop needs (src/lib/worker-runs.ts), shared by POST /api/workers (start) and
 * POST /api/workers/answer (T558, resume). Not a route: Next only serves route.ts.
 */
import path from 'path'
import { claimNextTask, getTask, listChats, readProjectSettings, saveChat, type WorkerSettings } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { workerArgs, workerEnv } from '@/lib/worker-args'
import { reserveWorker, startWorker, type WorkerChat, type WorkerDeps } from '@/lib/worker-runs'

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
  }
}

/**
 * T567: a paused worker survives a restart: its `retryAt` is saved, and the first chat list after the restart picks it
 * up again (the loop sleeps until `retryAt`, then goes on). Already in memory (`reserveWorker` says so) = left alone.
 */
// ponytail: resumes on the next GET /api/conversations of that project, not at boot; a startup hook if nobody opens VibeDoc
export async function resumePausedWorkers(root: string, origin: string): Promise<void> {
  const paused = (await listChats(root) as WorkerChat[]).filter(c => c.worker?.phase === 'paused')
  if (!paused.length) return
  const { workers } = await readProjectSettings(root)
  for (const chat of paused) {
    if (reserveWorker(root, chat.id, chat.worker.target.id, workers.maxRunning, chat.worker.port)) continue
    startWorker(root, chat, workerDeps(root, chat, origin, workers))
  }
}

export const saveWorkerChat = (root: string) => async (c: WorkerChat) => {
  await saveChat(c, root)
  emitUpdate('worker_updated', { id: c.id, phase: c.worker.phase, worker: c.worker })
  emitUpdate('chat_saved', { id: c.id })
}
