import { redirect } from "next/navigation"
import { listRoadmap, listTasks, rootFrom } from "@/lib/core"
import { isDemo } from "@/lib/demo"
import { firstScreen } from "@/lib/first-screen"

// The first screen (R082): a project with no tasks and no roadmap gets the welcome, any other opens the board
export const dynamic = "force-dynamic"

export default async function Page({ searchParams }: { searchParams: Promise<{ root?: string }> }) {
  const { root: rootArg } = await searchParams
  const root = rootFrom(rootArg)
  const [{ tasks }, { items }] = await Promise.all([listTasks(root), listRoadmap(root)])
  const target = firstScreen({ tasks: tasks.length, roadmapItems: items.length, demo: isDemo() })
  const query = rootArg ? `?root=${encodeURIComponent(rootArg)}` : ""
  redirect(`/${target}${query}`)
}
