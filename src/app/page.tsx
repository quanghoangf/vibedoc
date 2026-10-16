import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { findHubProject, getConfiguredRoot, listRoadmap, listTasks, rootFrom } from "@/lib/core"
import { isDemo } from "@/lib/demo"
import { LAST_PAGE_COOKIE, firstScreen, lastPageTarget } from "@/lib/first-screen"

// The first screen (R082): a project with no tasks and no roadmap gets the welcome, any other the last page used there (else the board)
export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ root?: string; project?: string }> }) {
  const { root: rootArg, project: projectArg } = await searchParams
  const demo = isDemo()
  // R099: `?project=<hub id>` names the project; an unknown id falls back to the configured root (the app toasts)
  const picked = projectArg && !demo ? await findHubProject(projectArg) : null
  const root = picked?.root ?? rootFrom(rootArg)
  const project = picked ?? (demo ? null : await findHubProject(rootArg ? root : getConfiguredRoot()))
  const [{ tasks }, { items }] = await Promise.all([listTasks(root), listRoadmap(root)])
  const target = firstScreen({ tasks: tasks.length, roadmapItems: items.length, demo })
  const query = new URLSearchParams()
  if (rootArg) query.set("root", rootArg)
  if (projectArg) query.set("project", projectArg)
  const qs = query.size ? `?${query}` : ""
  // the demo always opens the board (some pages are blocked there)
  const page = target === "start" ? "/start" : demo ? "/board" : lastPageTarget((await cookies()).get(LAST_PAGE_COOKIE)?.value, project?.id ?? "")
  redirect(`${page}${qs}`)
}
