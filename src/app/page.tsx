import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { listRoadmap, listTasks, rootFrom } from "@/lib/core"
import { isDemo } from "@/lib/demo"
import { LAST_PAGE_COOKIE, firstScreen, lastPageTarget } from "@/lib/first-screen"

// The first screen (R082): a project with no tasks and no roadmap gets the welcome, any other the last page used (else the board)
export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ root?: string }> }) {
  const { root: rootArg } = await searchParams
  const root = rootFrom(rootArg)
  const [{ tasks }, { items }] = await Promise.all([listTasks(root), listRoadmap(root)])
  const demo = isDemo()
  const target = firstScreen({ tasks: tasks.length, roadmapItems: items.length, demo })
  const query = rootArg ? `?root=${encodeURIComponent(rootArg)}` : ""
  // the demo always opens the board (some pages are blocked there)
  const page = target === "start" ? "/start" : demo ? "/board" : lastPageTarget((await cookies()).get(LAST_PAGE_COOKIE)?.value)
  redirect(`${page}${query}`)
}
