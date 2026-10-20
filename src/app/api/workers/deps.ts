/**
 * The core calls a worker loop needs (src/lib/worker-runs.ts), shared by POST /api/workers (start) and
 * POST /api/workers/answer (T558, resume). Not a route: Next only serves route.ts.
 */
import path from 'path'
import { claimNextTask, getTask, saveChat, type WorkerSettings } from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { workerArgs, workerEnv } from '@/lib/worker-args'
import type { WorkerChat, WorkerDeps } from '@/lib/worker-runs'

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
    }),
    // T557: a minimal env, so VibeDoc's tokens never reach the agent; PORT = its own dev server port (T559)
    env: { ...workerEnv(process.env, workers.env), ...(chat.worker.port && { PORT: String(chat.worker.port) }) },
    save: saveWorkerChat(root),
  }
}

export const saveWorkerChat = (root: string) => async (c: WorkerChat) => {
  await saveChat(c, root)
  emitUpdate('worker_updated', { id: c.id, phase: c.worker.phase, worker: c.worker })
  emitUpdate('chat_saved', { id: c.id })
}
