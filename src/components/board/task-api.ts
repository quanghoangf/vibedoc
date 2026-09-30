import type { Task, TaskMetaPatch } from "@/types"
import { undoToast } from "@/components/ui/toast"

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`)
  return json as T
}

export const updateTask = (id: string, patch: TaskMetaPatch, rootParam: string) =>
  post<{ task: Task }>(`/api/tasks/update${rootParam}`, { id, patch }).then((r) => r.task)

/** Deletes right away and offers Undo, which writes the same file back and re-links it to its epics. */
export async function deleteTaskWithUndo(task: Pick<Task, "id">, rootParam: string): Promise<void> {
  const { task: removed, links } = await post<{ task: Task; links: unknown[] }>(`/api/tasks/delete${rootParam}`, { id: task.id })
  undoToast(`Deleted ${removed.id}`, async () => {
    await post(`/api/tasks/restore${rootParam}`, { file: removed.file, raw: removed.raw, links })
  })
}
