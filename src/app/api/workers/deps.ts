/**
 * The core calls a worker loop needs (src/lib/worker-runs.ts), shared by POST /api/workers (start) and
 * POST /api/workers/answer (T558, resume). Not a route: Next only serves route.ts.
 */
import path from 'path'
import { claimNextTask, getChat, getTask, listChats, readProjectSettings, saveChat, sendBackTask, type WorkerSettings } from '@/lib/core'
import { addChat, ORCHESTRATOR_ID, ORCHESTRATOR_TITLE, type Chat } from '@/lib/chats'
import { emitUpdate } from '@/lib/events'
import { workerArgs, workerEnv } from '@/lib/worker-args'
import { formatFindingsNote } from '@/lib/verification'
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
    args: (taskId, { resume, verify } = {}) => workerArgs({
      taskId, mainRoot: root, mcpOrigin: origin, workerId: chat.id, resume, verify,
      // VibeDoc's own plugin, read from the package like readPlanningSkill()
      pluginDir: path.join(process.cwd(), 'plugin'),
      allowed: workers.allowedTools,
      maxTurns: workers.maxTurnsPerTask,
    }),
    // T557: a minimal env, so VibeDoc's tokens never reach the agent; PORT = its own dev server port (T559)
    env: { ...workerEnv(process.env, workers.env), ...(chat.worker.port && { PORT: String(chat.worker.port) }) },
    save: saveWorkerChat(root),
    notify: (note) => noteOrchestrator(root, note),
    budget: { maxTurns: workers.maxTurnsPerTask, timeoutMin: workers.taskTimeoutMin },
    verify: workers.verify,
    findings: async (taskId) => (await getTask(taskId, root)).verification?.findings.filter(f => f.severity !== 'minor') ?? [],
    sendBack: async (taskId, findings) => {
      const { task, previousStatus } = await sendBackTask(taskId, formatFindingsNote(findings), root)
      emitUpdate('task_updated', { taskId: task.id, status: task.status, previousStatus, task })
    },
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
