/**
 * The core calls a worker loop needs (src/lib/worker-runs.ts), shared by POST /api/workers (start) and
 * POST /api/workers/answer (T558, resume). Not a route: Next only serves route.ts.
 */
import path from 'path'
import { claimNextTask, getChat, getTask, saveChat, type WorkerSettings } from '@/lib/core'
import { addChat, ORCHESTRATOR_ID, ORCHESTRATOR_TITLE, type Chat } from '@/lib/chats'
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
    notify: (note) => noteOrchestrator(root, note),
  }
}

export const saveWorkerChat = (root: string) => async (c: WorkerChat) => {
  await saveChat(c, root)
  emitUpdate('worker_updated', { id: c.id, phase: c.worker.phase, worker: c.worker })
  emitUpdate('chat_saved', { id: c.id })
}

/** Notes kept for the orchestrator's next turn; older ones drop off while nobody asks it anything. */
const MAX_ORCHESTRATOR_NOTES = 20

/**
 * T562: a worker stopped → a note in the orchestrator chat (created if it isn't saved yet), and `orchestrator_note`
 * so an open page adds it to its copy too: the browser saves that chat, and would otherwise write the note away.
 */
// ponytail: a browser save racing this write (same instant) can drop one note; give notes their own file if that bites
export async function noteOrchestrator(root: string, note: string) {
  const chat = (await getChat(ORCHESTRATOR_ID, root) as Chat | null) ?? addChat([], ORCHESTRATOR_ID, { title: ORCHESTRATOR_TITLE })[0]
  chat.notes = [...(chat.notes ?? []), note].slice(-MAX_ORCHESTRATOR_NOTES)
  await saveChat(chat, root)
  emitUpdate('orchestrator_note', { id: ORCHESTRATOR_ID, note })
}
