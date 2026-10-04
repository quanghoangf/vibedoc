import type { Metadata } from "next"
import Link from "next/link"
import { CopyCommand } from "./CopyCommand"

export const metadata: Metadata = {
  title: "VibeDoc — a home for your AI coding agent",
  description: "Kanban board, docs viewer and MCP server in one local process. Your agent moves tasks, you watch it live.",
}

const GITHUB = "https://github.com/quanghoangf/vibedoc"

const FEATURES = [
  { title: "Board + MCP tools", body: "Tasks are markdown files in plans/tasks. Your agent claims, moves and finishes them through 38 MCP tools, and the card moves on your board as it happens." },
  { title: "Roadmap", body: "Horizons and epics on a map or a timeline, with progress and at-risk flags derived from the tasks under each epic." },
  { title: "Memory", body: "A session handoff plus one-fact knowledge entries. The next agent reads them first and picks up where the last one stopped." },
  { title: "Agent chat", body: "Ask an agent to plan a roadmap, break an epic into tasks or edit a doc. It shows the plan or the diff, and writes nothing until you accept." },
]

const button = "rounded-lg px-4 py-2 text-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"

/** Landing page (R042): outside the (app) group, so no sidebar or header. */
export default function WelcomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">VibeDoc</p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-txt sm:text-5xl">
        A home for your AI coding agent.
      </h1>
      <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">
        Kanban board, docs viewer and MCP server in one local process. Your agent reads the plan, moves tasks and
        leaves a handoff. You watch it live.
      </p>

      <div className="mt-8">
        <CopyCommand command="npx vibedoc" />
      </div>

      <nav aria-label="Get started" className="mt-6 flex flex-wrap gap-3">
        <Link href="/board" className={`${button} bg-accent text-accent-fg hover:opacity-90`}>Open live demo</Link>
        <Link href="/roadmap" className={`${button} border border-border text-txt hover:bg-surface2`}>See the roadmap</Link>
        <Link href="/getting-started" className={`${button} border border-border text-txt hover:bg-surface2`}>Getting started</Link>
        <a href={GITHUB} className={`${button} border border-border text-txt hover:bg-surface2`}>GitHub</a>
      </nav>

      <section aria-labelledby="features" className="mt-16">
        <h2 id="features" className="sr-only">Features</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.title} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-display text-base font-semibold text-txt">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
