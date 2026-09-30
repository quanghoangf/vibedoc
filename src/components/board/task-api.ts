import type { Task, TaskMetaPatch } from "@/types"

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.error ?? `Request failed (${res.status})`)
  return json as T
}

export const updateTask = (id: string, patch: TaskMetaPatch, rootParam: string) =>
  post<{ task: Task }>(`/api/tasks/update${rootParam}`, { id, patch }).then((r) => r.task)

/** Asks first; resolves to the removed task, or null when the user cancels. */
export async function deleteTaskWithConfirm(task: Pick<Task, "id" | "title">, rootParam: string): Promise<Task | null> {
  if (!window.confirm(`Delete ${task.id}: ${task.title}?`)) return null
  return post<{ task: Task }>(`/api/tasks/delete${rootParam}`, { id: task.id }).then((r) => r.task)
}
