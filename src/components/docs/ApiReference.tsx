"use client"

// R094: the project's OpenAPI spec as a browsable reference in /docs (list grouped by tag → one endpoint's contract).
import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Braces, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useT } from "@/context/LanguageContext"
import { useApp } from "@/context/AppContext"
import type { Content, Endpoint, EndpointDetail } from "@/lib/openapi"

/** `GET /api/openapi`: no spec → path null. */
export type ApiSpecList = { path: string | null; title?: string; endpoints?: Endpoint[]; error?: string }

/** URL value of `?api=`: "1" = the list, else "<METHOD> <path>". */
export const API_LIST = "1"
export const endpointKey = (e: { method: string; path: string }) => `${e.method} ${e.path}`

const METHOD_TONE: Record<string, string> = {
  GET: "text-teal border-teal/40",
  POST: "text-accent border-accent/40",
  PUT: "text-amber border-amber/40",
  PATCH: "text-amber border-amber/40",
  DELETE: "text-danger border-danger/40",
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span className={cn("inline-flex h-4 w-14 shrink-0 items-center justify-center rounded-sm border font-mono text-[10px] font-semibold leading-none", METHOD_TONE[method] ?? "text-muted border-border")}>
      {method}
    </span>
  )
}

/** The pinned row at the top of the docs list. */
export function ApiReferenceRow({ count, active, onClick }: { count: number; active: boolean; onClick: () => void }) {
  const { t, tn } = useT()
  return (
    <div className="mb-2">
      <button
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "w-full flex items-center gap-2 h-7 px-2 rounded-md text-xs transition-colors",
          active ? "bg-accent/10 text-accent font-medium" : "text-muted hover:text-txt hover:bg-surface2",
        )}
      >
        <Braces className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        <span className="truncate">{t("apiRef.title")}</span>
        <span className="ml-auto shrink-0 font-mono text-[10px] text-muted">{tn("apiRef.endpoints", count)}</span>
      </button>
      <div className="mt-2 border-t border-border" />
    </div>
  )
}

function Shape({ shape }: { shape: string }) {
  return <pre data-user-content className="overflow-x-auto rounded-md border border-border bg-surface2 px-3 py-2 font-mono text-[11px] leading-relaxed text-txt">{shape}</pre>
}

function ContentList({ content, empty }: { content: Content[]; empty: string }) {
  if (!content.length) return <p className="text-xs text-muted">{empty}</p>
  return (
    <div className="space-y-2">
      {content.map((c) => (
        <div key={c.type} className="space-y-1">
          <code data-user-content className="font-mono text-[11px] text-muted">{c.type}</code>
          <Shape shape={c.shape} />
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted">{title}</h3>
      {children}
    </section>
  )
}

type TryResult = { status: number; statusText: string; elapsedMs: number; contentType: string; body: string; truncated: boolean; url: string }

const pretty = (r: TryResult) => {
  if (!r.contentType.includes("json")) return r.body
  try { return JSON.stringify(JSON.parse(r.body), null, 2) } catch { return r.body }
}

/** T502: one request to the project's local app through POST /api/openapi/try (the server picks the host). */
function TryIt({ d, rootParam }: { d: EndpointDetail; rootParam: string }) {
  const { t } = useT()
  const inputs = d.parameters.filter((p) => p.in === "path" || p.in === "query")
  const [values, setValues] = useState<Record<string, string>>({})
  const [body, setBody] = useState(d.requestBody ? "{}" : "")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<TryResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setSending(true)
    setError(null)
    setResult(null)
    const pick = (where: string) => Object.fromEntries(inputs.filter((p) => p.in === where).map((p) => [p.name, values[`${where}:${p.name}`] ?? ""]))
    try {
      const res = await fetch(`/api/openapi/try${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: d.method, path: d.path, params: pick("path"), query: pick("query"), body }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data) setResult(data)
      else setError(data?.error ?? String(res.status))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Section title={t("apiRef.tryIt")}>
      <p className="text-xs text-muted">{t("apiRef.tryHint")}</p>
      <form
        className="space-y-2"
        onSubmit={(e) => { e.preventDefault(); if (!sending) send() }}
      >
        {inputs.map((p) => {
          const key = `${p.in}:${p.name}`
          return (
            <label key={key} className="flex items-center gap-2 text-xs">
              <code data-user-content className="w-32 shrink-0 truncate font-mono text-txt">{p.name}</code>
              <input
                aria-label={p.name}
                value={values[key] ?? ""}
                required={p.required}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                placeholder={p.shape.includes("\n") ? "" : p.shape}
                className="h-7 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 font-mono text-xs text-txt outline-none focus:border-accent"
              />
            </label>
          )
        })}
        {d.requestBody && (
          <label className="block space-y-1 text-xs">
            <span className="text-muted">{t("apiRef.body")}</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              spellCheck={false}
              className="block w-full rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-xs text-txt outline-none focus:border-accent"
            />
          </label>
        )}
        <button
          type="submit"
          disabled={sending}
          className="inline-flex h-7 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-fg hover:opacity-90 disabled:opacity-60"
        >
          {sending ? t("apiRef.sending") : t("apiRef.send")}
        </button>
      </form>
      {error && <p role="alert" className="rounded-md border border-danger/40 px-3 py-2 text-xs text-danger">{t("apiRef.tryFailed", { message: error })}</p>}
      {result && (
        <div className="space-y-1.5" data-try-result>
          <p className="flex flex-wrap items-baseline gap-2 text-xs">
            <span data-user-content className={cn("font-mono font-semibold", result.status < 400 ? "text-teal" : "text-danger")}>{result.status} {result.statusText}</span>
            <span className="text-muted">{t("apiRef.elapsed", { ms: result.elapsedMs })}</span>
            {result.truncated && <span className="text-amber">{t("apiRef.truncated")}</span>}
            <code data-user-content className="ml-auto truncate font-mono text-[10px] text-muted">{result.url}</code>
          </p>
          {result.body && <Shape shape={pretty(result)} />}
        </div>
      )}
    </Section>
  )
}

function Detail({ d, rootParam, canTry }: { d: EndpointDetail; rootParam: string; canTry: boolean }) {
  const { t } = useT()
  return (
    <div className="space-y-6" data-endpoint={endpointKey(d)}>
      <header className="space-y-1.5">
        <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-txt">
          <MethodBadge method={d.method} />
          <code data-user-content className="font-mono break-all">{d.path}</code>
          {d.deprecated && <span className="rounded-sm border border-amber/40 px-1 text-[10px] font-normal text-amber">{t("apiRef.deprecated")}</span>}
        </h2>
        {d.summary && <p data-user-content className="text-sm text-txt">{d.summary}</p>}
        {d.description && d.description !== d.summary && <p data-user-content className="whitespace-pre-line text-xs text-muted">{d.description}</p>}
      </header>

      <Section title={t("apiRef.parameters")}>
        {d.parameters.length === 0 ? (
          <p className="text-xs text-muted">{t("apiRef.noParameters")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className="py-1 pr-3 font-medium">{t("apiRef.colName")}</th>
                  <th className="py-1 pr-3 font-medium">{t("apiRef.colIn")}</th>
                  <th className="py-1 pr-3 font-medium">{t("apiRef.colType")}</th>
                  <th className="py-1 font-medium">{t("apiRef.colDescription")}</th>
                </tr>
              </thead>
              <tbody>
                {d.parameters.map((p) => (
                  <tr key={`${p.in}:${p.name}`} className="border-t border-border align-top">
                    <td className="py-1.5 pr-3">
                      <code data-user-content className="font-mono text-txt">{p.name}</code>
                      {p.required && <span className="ml-1.5 text-[10px] text-danger">{t("apiRef.required")}</span>}
                    </td>
                    <td data-user-content className="py-1.5 pr-3 font-mono text-muted">{p.in}</td>
                    <td data-user-content className="py-1.5 pr-3 font-mono text-muted whitespace-pre">{p.shape}</td>
                    <td data-user-content className="py-1.5 text-muted">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={d.requestBody?.required ? `${t("apiRef.requestBody")} · ${t("apiRef.required")}` : t("apiRef.requestBody")}>
        {d.requestBody ? (
          <>
            {d.requestBody.description && <p data-user-content className="text-xs text-muted">{d.requestBody.description}</p>}
            <ContentList content={d.requestBody.content} empty={t("apiRef.noContent")} />
          </>
        ) : (
          <p className="text-xs text-muted">{t("apiRef.noRequestBody")}</p>
        )}
      </Section>

      <Section title={t("apiRef.responses")}>
        {d.responses.length === 0 ? (
          <p className="text-xs text-muted">{t("apiRef.noResponses")}</p>
        ) : (
          <div className="space-y-4">
            {d.responses.map((r) => (
              <div key={r.status} className="space-y-1.5" data-status={r.status}>
                <p className="text-xs">
                  <span data-user-content className={cn("font-mono font-semibold", r.status.startsWith("2") ? "text-teal" : r.status.startsWith("4") || r.status.startsWith("5") ? "text-danger" : "text-txt")}>{r.status}</span>
                  {r.description && <span data-user-content className="ml-2 text-muted">{r.description}</span>}
                </p>
                <ContentList content={r.content} empty={t("apiRef.noContent")} />
              </div>
            ))}
          </div>
        )}
      </Section>

      {canTry && <TryIt key={endpointKey(d)} d={d} rootParam={rootParam} />}
    </div>
  )
}

interface ApiReferenceProps {
  spec: ApiSpecList
  /** `?api=` value: API_LIST or an endpoint key */
  open: string
  onOpen: (key: string | null) => void
  rootParam: string
}

export function ApiReference({ spec, open, onOpen, rootParam }: ApiReferenceProps) {
  const { t } = useT()
  const { demo, playground } = useApp()
  const endpoint = open === API_LIST ? null : open
  const [loaded, setLoaded] = useState<{ key: string; detail: EndpointDetail | null } | null>(null)

  useEffect(() => {
    if (!endpoint) return
    const space = endpoint.indexOf(" ")
    const q = `method=${encodeURIComponent(endpoint.slice(0, space))}&path=${encodeURIComponent(endpoint.slice(space + 1))}`
    let live = true
    fetch(`/api/openapi${rootParam}&${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live) setLoaded({ key: endpoint, detail: d }) })
      .catch(() => { if (live) setLoaded({ key: endpoint, detail: null }) })
    return () => { live = false }
  }, [endpoint, rootParam])

  const groups = useMemo(() => {
    const m = new Map<string, Endpoint[]>()
    for (const e of spec.endpoints ?? []) {
      const tag = e.tags[0] ?? ""
      m.set(tag, [...(m.get(tag) ?? []), e])
    }
    // Untagged endpoints last
    return [...m.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0))
  }, [spec.endpoints])

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8" role="region" aria-label={t("apiRef.title")}>
      <div className="mb-5 flex items-center gap-2">
        {endpoint ? (
          <button onClick={() => onOpen(API_LIST)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-txt">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {t("apiRef.allEndpoints")}
          </button>
        ) : (
          <h1 className="flex items-center gap-2 text-base font-semibold text-txt">
            <Braces className="h-4 w-4 text-muted" aria-hidden />
            {t("apiRef.title")}
            {spec.title && <span data-user-content className="text-sm font-normal text-muted">{spec.title}</span>}
          </h1>
        )}
        <code data-user-content className="ml-auto truncate font-mono text-[10px] text-muted">{spec.path}</code>
        <button onClick={() => onOpen(null)} aria-label={t("apiRef.close")} title={t("apiRef.close")} className="rounded-sm p-1 text-muted hover:bg-surface2 hover:text-txt">
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {spec.error ? (
        <p className="rounded-md border border-danger/40 px-3 py-2 text-xs text-danger">{t("apiRef.unreadable", { message: spec.error })}</p>
      ) : endpoint ? (
        loaded?.key !== endpoint ? (
          <p className="text-xs text-muted">{t("apiRef.loading")}</p>
        ) : loaded.detail ? (
          <Detail d={loaded.detail} rootParam={rootParam} canTry={!demo && !playground} />
        ) : (
          <p className="text-xs text-muted">{t("apiRef.notFound")}</p>
        )
      ) : (
        <div className="space-y-5">
          {groups.map(([tag, list]) => (
            <section key={tag || "~untagged"} className="space-y-1" data-tag={tag}>
              <h2 className="px-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted">
                {tag ? <span data-user-content>{tag}</span> : t("apiRef.untagged")}
              </h2>
              <ul>
                {list.map((e) => (
                  <li key={endpointKey(e)}>
                    <button
                      onClick={() => onOpen(endpointKey(e))}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface2"
                    >
                      <MethodBadge method={e.method} />
                      <code data-user-content className={cn("font-mono text-txt", e.deprecated && "line-through opacity-60")}>{e.path}</code>
                      {e.summary && <span data-user-content className="ml-auto truncate text-muted max-md:hidden">{e.summary}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
