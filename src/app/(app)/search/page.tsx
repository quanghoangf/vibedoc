"use client"

import { Suspense, useEffect, useRef, useState, type KeyboardEvent } from "react"
import { useSearchParams } from "next/navigation"
import { Search } from "lucide-react"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import { KIND_LABEL, fetchSearch, useOpenResult } from "@/components/search/search-results"
import { highlightParts, snippetText, stepIndex, type CrossGroup } from "@/lib/cross-search"
import { NoMatch } from "@/components/search/NoMatch"

type Result = { key: string; status: "done"; groups: CrossGroup[] } | { key: string; status: "error"; error: string }

/** `text` with the query's words in <mark> (a neutral tint, never accent). */
function Marked({ text, query }: { text: string; query: string }) {
  return highlightParts(text, query).map((p, i) => p.hit
    ? <mark key={i} className="rounded-sm bg-txt/12 px-px font-medium text-txt">{p.text}</mark>
    : p.text)
}

/** /search?q=&scope= (R107 T551): docs, tasks, epics and entries across projects, grouped by project. */
export default function SearchPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  )
}

function SearchView() {
  const params = useSearchParams()
  const { activeProjectId, groups, rootParam, openDoc } = useApp()
  const { t, tn } = useT()
  const open = useOpenResult()
  const [query, setQuery] = useState(() => params.get("q") ?? "")
  const [scope, setScope] = useState(() => params.get("scope") || "all")
  const [result, setResult] = useState<Result | null>(null)
  const q = query.trim()
  // "project:" before projects load would 404: wait for the id
  const effectiveScope = scope === "project" ? (activeProjectId ? `project:${activeProjectId}` : "") : scope
  const key = `${effectiveScope}\0${q}`

  // the URL is the state, so a reload or a copied link keeps the search
  useEffect(() => {
    const url = new URL(window.location.href)
    if (q) url.searchParams.set("q", q)
    else url.searchParams.delete("q")
    if (scope !== "all") url.searchParams.set("scope", scope)
    else url.searchParams.delete("scope")
    window.history.replaceState(window.history.state, "", url)
  }, [q, scope])

  useEffect(() => {
    if (!q || !effectiveScope) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      fetchSearch(q, effectiveScope, ctrl.signal).then(
        (groups) => setResult({ key, status: "done", groups }),
        (e: Error) => { if (e.name !== "AbortError") setResult({ key, status: "error", error: e.message }) },
      )
    }, 200)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [q, effectiveScope, key])

  // "Show all" for one project: every hit, swapped into its group (only for the search it was asked on)
  const [full, setFull] = useState<{ key: string; id: string; status: "loading" | "error" | "done"; group?: CrossGroup; error?: string }[]>([])
  const fullFor = (id: string) => full.find((f) => f.key === key && f.id === id)
  const showAll = (id: string) => {
    const k = key
    setFull((xs) => [...xs.filter((f) => f.key === k && f.id !== id), { key: k, id, status: "loading" }])
    fetchSearch(q, `project:${id}`, undefined, true).then(
      (gs) => setFull((xs) => xs.map((f) => f.key === k && f.id === id ? { ...f, status: "done", group: gs[0] } : f)),
      (e: Error) => setFull((xs) => xs.map((f) => f.key === k && f.id === id ? { ...f, status: "error", error: e.message } : f)),
    )
  }

  const current = result?.key === key ? result : null
  const shown = current?.status === "done"
    ? current.groups.map((g) => { const f = fullFor(g.project.id); return f?.status === "done" && f.group ? f.group : g })
    : []
  const count = shown.reduce((n, g) => n + g.results.length, 0)
  const total = shown.reduce((n, g) => n + g.total, 0)

  // ↑/↓ (j/k on a result) walk the results, Home/End jump; Enter is the focused button's own click
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const onResultsKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const rows = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-result]") ?? [])]
    const inInput = e.target === inputRef.current
    if (inInput && e.key !== "ArrowDown") return
    const at = inInput ? -1 : rows.indexOf(e.target as HTMLButtonElement)
    if (!inInput && at < 0) return
    if (at === 0 && (e.key === "ArrowUp" || e.key === "k")) { e.preventDefault(); inputRef.current?.focus(); return }
    const next = stepIndex(at, rows.length, e.key)
    if (next === null) return
    e.preventDefault()
    rows[next].focus()
  }

  // nothing anywhere: doc names in this project that look like the query (a miss is a question, R087)
  const [suggested, setSuggested] = useState<{ q: string; paths: string[] } | null>(null)
  const missed = current?.status === "done" && count === 0
  useEffect(() => {
    if (!missed) return
    const ctrl = new AbortController()
    fetch(`/api/docs${rootParam}&suggest=${encodeURIComponent(q)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: { suggestions?: string[] }) => setSuggested({ q, paths: d?.suggestions ?? [] }))
      .catch(() => setSuggested({ q, paths: [] }))
    return () => ctrl.abort()
  }, [missed, q, rootParam])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-4 border-b border-border pb-5">
        <h1 className="text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-txt">{t("search.title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t("search.lead")}</p>
      </header>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-2.5 size-4 text-muted" aria-hidden />
          <input
            ref={inputRef}
            onKeyDown={onResultsKey}
            autoFocus
            type="search"
            aria-label={t("search.inputLabel")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="h-9 w-full min-w-0 rounded-md border border-border bg-bg pl-8 pr-2 text-sm text-txt placeholder:text-muted hover:border-border2 focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>
        <select
          aria-label={t("search.scopeLabel")}
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="h-9 min-w-0 rounded-md border border-border bg-bg px-2 text-sm text-txt hover:border-border2 focus-visible:outline-2 focus-visible:outline-accent sm:w-56"
        >
          <option value="all">{t("search.scopeAll")}</option>
          {groups.map((g) => <option key={g.slug} value={`group:${g.slug}`}>{t("search.scopeGroup", { name: g.name })}</option>)}
          <option value="project">{t("search.scopeProject")}</option>
        </select>
      </div>

      <div aria-live="polite">
        {!q && <p className="text-sm text-muted">{t("search.typeToSearch")}</p>}
        {q && !current && <p className="text-sm text-muted">{t("search.searching")}</p>}
        {current?.status === "error" && <p role="alert" className="text-sm text-danger">{t("search.failed", { error: current.error })}</p>}
        {missed && (
          <NoMatch
            message={t("search.nothing", { query: q })}
            suggestions={suggested?.q === q ? suggested.paths : []}
            onOpen={(path) => { void openDoc(path) }}
            action={scope !== "all" ? { label: t("search.tryAllProjects"), onClick: () => setScope("all") } : undefined}
          />
        )}
        {current?.status === "done" && count > 0 && <p className="mb-3 text-xs text-muted">{tn("search.results", total)} <span className="hidden sm:inline">· {t("search.keysHint")}</span></p>}
      </div>

      <div ref={listRef} onKeyDown={onResultsKey}>
      {shown.map((g) => {
        const f = fullFor(g.project.id)
        const hidden = g.total > g.results.length
        // two results with one title (README, index…) need their paths to tell them apart
        const titles = new Map<string, number>()
        for (const r of g.results) titles.set(r.title, (titles.get(r.title) ?? 0) + 1)
        return (
        <section key={g.project.id} data-search-project={g.project.id} aria-labelledby={`search-p-${g.project.id}`} className="mb-6">
          <h2 id={`search-p-${g.project.id}`} className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-txt">
            <span data-user-content>{g.project.name}</span>
            {g.project.id === activeProjectId && <span className="rounded-sm bg-surface2 px-1.5 py-px text-[10px] font-normal text-muted">{t("search.current")}</span>}
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {g.results.map((r) => (
              <li key={`${r.kind}:${r.path}:${r.id ?? ""}`}>
                <button
                  type="button"
                  data-result
                  onClick={() => open(r)}
                  className="flex w-full min-w-0 flex-col px-3 py-2 text-left hover:bg-surface2 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span data-kind className="w-24 shrink-0 truncate font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted">{t(KIND_LABEL[r.kind])}</span>
                    {r.id && <span className="shrink-0 font-mono text-[11px] text-muted">{r.id}</span>}
                    <span data-user-content className="min-w-0 truncate text-[13px] text-txt"><Marked text={r.title} query={q} /></span>
                  </span>
                  {(r.kind === "doc" || (titles.get(r.title) ?? 0) > 1) && <span data-user-content className="block truncate pl-[6.5rem] font-mono text-[11px] text-muted">{r.path}</span>}
                  {r.kind === "doc" && r.snippet && <span data-user-content data-snippet className="block truncate pl-[6.5rem] text-xs text-muted"><Marked text={snippetText(r.snippet)} query={q} /></span>}
                </button>
              </li>
            ))}
          </ul>
          {hidden && (
            <p data-search-more className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
              <span>{t("search.topOf", { shown: g.results.length, total: g.total, project: g.project.name })}</span>
              <span aria-hidden>·</span>
              {f?.status === "loading"
                ? <span>{t("search.loadingAll")}</span>
                : (
                  <button type="button" onClick={() => showAll(g.project.id)} className="rounded-sm font-medium text-txt underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent">
                    {t("search.showAll")}
                  </button>
                )}
              {f?.status === "error" && <span role="alert" className="text-danger">{t("search.showAllFailed", { error: f.error ?? "" })}</span>}
            </p>
          )}
        </section>
        )
      })}
      </div>
    </div>
  )
}
