"use client"

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { marked } from "marked"
import { cn } from "@/lib/utils"
import { stripFrontmatter } from "@/lib/doc-priority"
import { isExampleTarget } from "@/lib/doc-links"
import { alertExtension } from "@/lib/md-alerts"
import { codeTabsExtension, groupFences } from "@/lib/md-code-tabs"
import { groupVisualBlocks, visualBlocksExtension } from "@/lib/md-visual-blocks"
import { useApp } from "@/context/AppContext"
import { useOpenNode } from "@/components/memory/EntryRelated"
import { toast } from "@/components/ui/toast"
import { useDocLinks, type DocLinksData } from "./useDocLinks"
import { LinkPreview } from "./LinkPreview"
import { useCodeTabs } from "./code-tabs"
import { decorateDiagram, useDiagramTools } from "./diagram-viewer"
import { tNow } from "@/context/LanguageContext"
import { resolveImageSrc } from "@/lib/attachments"
import { MERMAID_TOKENS, mermaidThemeVariables, type MermaidTokens } from "@/lib/mermaid-theme"

// Configure marked for GitHub Flavored Markdown
marked.setOptions({
  gfm: true,
  breaks: false,
})

// GFM alerts `> [!NOTE]` … `> [!CAUTION]` as callouts (R089)
marked.use({ extensions: [alertExtension] })
// Consecutive titled fences (```bash title="pnpm") as one tabbed block (R089), and a list under
// <!-- vibedoc:steps|cards --> as cards (R096): one processAllTokens hook runs both groupings
marked.use({
  extensions: [codeTabsExtension, visualBlocksExtension],
  hooks: { processAllTokens: (tokens) => groupVisualBlocks(groupFences(tokens)) },
})

// Intercept mermaid code blocks — emit a div instead of <pre><code>
marked.use({
  renderer: {
    code({ text: code, lang }) {
      if (lang === "mermaid") {
        // HTML-escape so the raw source sits safely as text in the div.
        // The browser decodes entities back when mermaid reads textContent.
        const escaped = code
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
        return `<div class="mermaid not-prose">${escaped}</div>`
      }
      return false // default renderer handles all other code blocks
    },
  },
})

// Inject id attributes on h1-h6 headings for outline scroll-to
marked.use({
  renderer: {
    heading({ tokens, depth: level }) {
      const text = this.parser.parseInline(tokens)
      // Strip HTML tags before building the anchor slug
      const anchor = text
        .replace(/<[^>]*>/g, "")
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
      return `<h${level} id="${anchor}">${text}</h${level}>\n`
    }
  }
})

/** The design tokens Mermaid's themeVariables are built from, as computed now (follows .dark and the font setting). */
function readTokens(): MermaidTokens {
  const css = getComputedStyle(document.documentElement)
  const tokens: MermaidTokens = { fontMono: css.getPropertyValue("--app-font-mono") }
  for (const k of MERMAID_TOKENS) tokens[k] = css.getPropertyValue(`--rgb-${k}`)
  return tokens
}

/** A diagram that won't parse: its error (first line) and its source, in place of the diagram. */
function showMermaidError(node: HTMLElement, src: string, e: unknown) {
  const box = document.createElement("div")
  box.className = "mermaid-error"
  box.setAttribute("role", "note")
  const msg = document.createElement("p")
  msg.className = "mermaid-error-message"
  // a parse error is "Parse error on line N:", the source line, a ^ pointer, then "Expecting …": keep the first and last
  const lines = String((e as { message?: unknown })?.message ?? e).split("\n").map((l) => l.trim()).filter(Boolean)
  msg.textContent = lines.length > 1 ? `${lines[0]} ${lines[lines.length - 1]}` : (lines[0] ?? "")
  const pre = document.createElement("pre")
  pre.textContent = src
  box.append(msg, pre)
  node.replaceChildren(box)
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

// [[name]], [[name#h]], [[name|alias]], [[name#h|alias]]: same grammar as WIKI_RE in src/lib/doc-links.ts,
// so data-wiki (without #h) is the raw target the links API reports.
marked.use({
  extensions: [{
    name: "wikilink",
    level: "inline",
    start: (src: string) => { const i = src.indexOf("[["); return i < 0 ? undefined : i },
    tokenizer(src: string) {
      const m = /^\[\[([^\]|#]+)(?:#([^\]|]*))?(?:\|([^\]]+))?\]\]/.exec(src)
      if (!m || !m[1].trim()) return undefined
      return { type: "wikilink", raw: m[0], name: m[1].trim(), hash: m[2]?.trim() ?? "", alias: m[3]?.trim() ?? "" }
    },
    renderer(token) {
      const { name, hash, alias } = token as unknown as { name: string; hash: string; alias: string }
      const target = hash ? `${name}#${hash}` : name
      return `<a data-wiki="${escapeHtml(target)}" role="link" tabindex="0">${escapeHtml(alias || name)}</a>`
    },
  }],
})

function sanitize(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
}

// Relative `![](assets/T1/1.png)` sources load through /api/files/image, resolved against the file's folder (T512)
function withProjectImages(html: string, baseFile: string, rootParam: string): string {
  return html.replace(/(<img\b[^>]*?\ssrc=")([^"]*)"/gi, (whole, head: string, src: string) => {
    const rel = resolveImageSrc(src.replace(/&amp;/g, "&"), baseFile)
    if (!rel) return whole
    const sep = rootParam.length > 1 ? `${rootParam}&` : "?"
    return `${head}/api/files/image${sep}path=${encodeURIComponent(rel)}"`
  })
}

interface MarkdownRendererProps {
  content: string
  className?: string
  /** ms timestamp of the last agent edit; top-level blocks that change within HIGHLIGHT_WINDOW of it get marked */
  highlightSince?: number
  /** The doc being shown (docs preview only): makes its .md links and [[wikilinks]] open inside VibeDoc */
  docPath?: string
  /** The file the content comes from (project-relative), so its relative images load; defaults to docPath (T512) */
  basePath?: string
  /** React content placed at the end of the heading with this id (its slug), e.g. "Open in Test review" (T507) */
  headingAction?: { id: string; node: ReactNode }
}

// The agent's edit lands a moment after its SSE event (span apply or a fetch of the whole file)
const HIGHLIGHT_WINDOW = 3000

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className, highlightSince = 0, docPath, basePath, headingAction }: MarkdownRendererProps) {
  const { rootParam } = useApp()
  const imageBase = basePath ?? docPath
  // Frontmatter is metadata (e.g. a doc's priority), never body text
  const html = useMemo(() => {
    const out = sanitize(marked.parse(stripFrontmatter(content)) as string)
    return imageBase ? withProjectImages(out, imageBase, rootParam) : out
  }, [content, imageBase, rootParam])
  const containerRef = useRef<HTMLDivElement>(null)
  const prevBlocksRef = useRef<string[] | null>(null)

  // Mark blocks that weren't in the previous render (multiset match, so moved or duplicated blocks don't count).
  // Runs before mermaid replaces its divs, so both renders are compared as raw markup.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const blocks = Array.from(container.children)
    // data-broken / data-stale come and go with the links data (DocLinks), not with the content
    // the heading action is ours, not the doc's: leave it out so it never reads as a changed block
    const sigs = blocks.map((b) => { const a = b.querySelector("[data-heading-action]"); return (a ? b.outerHTML.replace(a.outerHTML, "") : b.outerHTML).replace(STALE_ATTRS_RE, "") })
    const prev = prevBlocksRef.current
    prevBlocksRef.current = sigs
    if (!prev || Date.now() - highlightSince > HIGHLIGHT_WINDOW) return
    const pool = new Map<string, number>()
    for (const s of prev) pool.set(s, (pool.get(s) ?? 0) + 1)
    blocks.forEach((b, i) => {
      const left = pool.get(sigs[i]) ?? 0
      if (left > 0) pool.set(sigs[i], left - 1)
      else b.classList.add("doc-block-changed")
    })
  }, [html, highlightSince])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let pass = 0 // a newer pass (theme switch) supersedes an unfinished one

    // all: a theme switch re-renders the diagrams already drawn, from the source kept in data-source
    const render = async (all: boolean) => {
      const m = await import("mermaid")
      if (cancelled || !container.isConnected) return
      // Query AFTER the async import resolves — gets current DOM, not stale snapshot
      const nodes = Array.from(container.querySelectorAll<HTMLElement>(all ? ".mermaid" : ".mermaid:not([data-processed])"))
      if (nodes.length === 0) return
      const mine = ++pass
      // claim every node before the first await, so a pass started meanwhile neither re-takes nor drops them
      for (const node of nodes) {
        node.dataset.source ??= node.textContent ?? ""
        node.dataset.processed = "true"
      }
      const dark = document.documentElement.classList.contains("dark")
      m.default.initialize({ startOnLoad: false, theme: "base", themeVariables: mermaidThemeVariables(readTokens(), dark), securityLevel: "antiscript" })
      for (const node of nodes) {
        const src = node.dataset.source ?? ""
        try {
          // parse first: a bad diagram never reaches render, which would leave Mermaid's error graphic behind
          await m.default.parse(src)
          const { svg, bindFunctions } = await m.default.render(`mermaid-${mine}-${Math.random().toString(36).slice(2)}`, src)
          if (cancelled || mine !== pass) return
          node.innerHTML = svg
          bindFunctions?.(node)
          decorateDiagram(node)
        } catch (e) {
          if (cancelled || mine !== pass) return
          showMermaidError(node, src, e)
        }
      }
    }

    // Debounce so rapid keystrokes (live preview) don't thrash mermaid
    const timer = setTimeout(() => { if (!cancelled) void render(false) }, 120)
    // <html class> also carries other flags: only a light/dark flip re-colours
    let dark = document.documentElement.classList.contains("dark")
    const mo = new MutationObserver(() => {
      const now = document.documentElement.classList.contains("dark")
      if (now !== dark) { dark = now; void render(true) }
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

    return () => {
      cancelled = true
      clearTimeout(timer)
      mo.disconnect()
    }
  }, [html])

  useCodeTabs(containerRef, html)
  const diagramDialog = useDiagramTools(containerRef, html)

  // A host span appended to the heading; a new html resets the container's markup, so it is re-made per render of it
  const actionId = headingAction?.id
  const [actionHost, setActionHost] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const heading = actionId ? containerRef.current?.querySelector<HTMLElement>(`:is(h1,h2,h3,h4,h5,h6)[id="${CSS.escape(actionId)}"]`) : null
    if (!heading) { setActionHost(null); return }
    const host = document.createElement("span")
    host.dataset.headingAction = ""
    host.className = "heading-action"
    heading.appendChild(host)
    setActionHost(host)
    return () => host.remove()
  }, [html, actionId])

  return (
    <>
      <div
        ref={containerRef}
        // the document is the user's own words: never translated (R078; e2e/i18n.mjs skips [data-user-content])
        data-user-content
        className={cn("prose-dark", className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {docPath && <DocLinks docPath={docPath} html={html} containerRef={containerRef} />}
      {actionHost && headingAction && createPortal(headingAction.node, actionHost)}
      {diagramDialog}
    </>
  )
})

const EXTERNAL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i
// the stale title is in the UI language (set when marking), so the signature strip matches any title
const STALE_ATTRS_RE = / data-broken=""| data-stale="" title="[^"]*"/g

/** Same slug rule as the heading renderer above; idempotent on a slug that is already one. */
const slug = (h: string) => {
  let t = h
  try { t = decodeURIComponent(h) } catch { /* keep it raw */ }
  return t.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")
}

/** Scroll to a heading; retries while a just-opened doc renders. */
export function scrollToHeading(hash: string, tries = 15) {
  const el = document.getElementById(slug(hash))
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (el) el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" })
  else if (tries > 0) setTimeout(() => scrollToHeading(hash, tries - 1), 100)
}

/** A doc link's raw target and #heading: `data-wiki`, or a relative `.md` href. Null for anything else. */
function docTarget(a: Element): { raw: string; hash: string } | null {
  const wiki = a.getAttribute("data-wiki")
  const href = wiki ?? a.getAttribute("href")
  if (!href || (wiki === null && (href.startsWith("#") || EXTERNAL_RE.test(href)))) return null
  const i = href.indexOf("#")
  let raw = i < 0 ? href : href.slice(0, i)
  // marked encodeURI()s hrefs; the links API keys targets as written in the file
  try { raw = decodeURI(raw) } catch { /* keep it raw */ }
  if (wiki === null && !/\.md$/i.test(raw)) return null
  return { raw, hash: i < 0 ? "" : href.slice(i + 1) }
}

// a reported broken link, or a syntax example (`[[name]]`) the counts skip; a file outside the graph (.claude/…) is neither
const isBroken = (links: DocLinksData, raw: string) =>
  !links.targets[raw] && (isExampleTarget(raw) || links.broken.some((b) => b.path === raw))
const inlineCode = (root: ParentNode) => Array.from(root.querySelectorAll(":not(pre) > code"))

/**
 * Scroll a link (or a backticked path) whose raw target is `target` into view in a rendered doc and flash it.
 * False when the preview has no such element (edit mode, a link inside a fence).
 */
export function revealLink(root: ParentNode, target: string): boolean {
  const el = Array.from(root.querySelectorAll("a")).find((a) => docTarget(a)?.raw === target)
    ?? inlineCode(root).find((c) => c.textContent === target)
  if (!(el instanceof HTMLElement)) return false
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  el.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" })
  flashElement(el)
  return true
}

/** The update flash (DESIGN.md) on one element; restarts if it is already running. */
export function flashElement(el: HTMLElement) {
  el.classList.remove("animate-flash")
  void el.offsetWidth // restart the flash on a repeat
  el.classList.add("animate-flash")
  el.addEventListener("animationend", () => el.classList.remove("animate-flash"), { once: true })
}

/**
 * Link handling for the docs preview (R056): one delegated click listener on the rendered doc, and
 * data-broken on links the links API lists as broken, data-stale on backticked paths to missing files, and the
 * `?link=` target (from /graph's broken list) scrolled into view once. Kept out of MarkdownRenderer so its other users
 * (chat, board, memory) don't need AppContext.
 */
function DocLinks({ docPath, html, containerRef }: { docPath: string; html: string; containerRef: RefObject<HTMLDivElement | null> }) {
  const links = useDocLinks(docPath)
  const router = useRouter()
  const { openDoc } = useApp()
  const openNode = useOpenNode((id) => router.push(`/memory?entry=${encodeURIComponent(id)}`))

  useEffect(() => {
    const container = containerRef.current
    if (!container || !links) return
    const marked = Array.from(container.querySelectorAll("a")).filter((a) => {
      const t = docTarget(a)
      return !!t && isBroken(links, t.raw)
    })
    const stale = new Set(links.stale.map((s) => s.path))
    const mentions = inlineCode(container).filter((c) => !links.targets[c.textContent ?? ""] && stale.has(c.textContent ?? ""))
    marked.forEach((a) => a.setAttribute("data-broken", ""))
    mentions.forEach((c) => { c.setAttribute("data-stale", ""); c.setAttribute("title", tNow("docs.fileNotFound")) })
    return () => {
      marked.forEach((a) => a.removeAttribute("data-broken"))
      mentions.forEach((c) => { c.removeAttribute("data-stale"); c.removeAttribute("title") })
    }
  }, [html, links, containerRef])

  // ?link=<raw target> (set by openDoc from /graph): reveal it once this doc and its links have rendered
  useEffect(() => {
    const container = containerRef.current
    const url = new URL(window.location.href)
    const target = url.searchParams.get("link")
    if (!container || !links || !target || url.searchParams.get("doc") !== docPath) return
    url.searchParams.delete("link")
    window.history.replaceState(window.history.state, "", url)
    revealLink(container, target)
  }, [html, links, docPath, containerRef])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onClick = (e: MouseEvent) => {
      // ⌘/Ctrl/Shift/Alt-click and middle-click stay the browser's
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest("a")
      if (!a || !container.contains(a)) return
      const href = a.getAttribute("href")
      if (href?.startsWith("#")) {
        e.preventDefault()
        scrollToHeading(href.slice(1))
        return
      }
      if (href && EXTERNAL_RE.test(href)) {
        e.preventDefault()
        window.open(href, "_blank", "noopener,noreferrer")
        return
      }
      const t = docTarget(a)
      if (!t) return
      e.preventDefault()
      if (!links) return // still loading; a second click works
      const node = links.targets[t.raw]
      if (!node) {
        toast(tNow("docs.notFoundTarget", { target: t.raw }))
        return
      }
      if (node.path === docPath) {
        if (t.hash) scrollToHeading(t.hash)
        return
      }
      if (node.kind === "doc" || node.kind === "adr" || node.kind === "spec") {
        void openDoc(node.path).then(() => { if (t.hash) scrollToHeading(t.hash) })
      } else {
        openNode(node)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      // wikilinks have no href, so Enter doesn't click them by itself
      if (e.key === "Enter" && (e.target as Element | null)?.matches?.("a[data-wiki]")) (e.target as HTMLElement).click()
    }
    container.addEventListener("click", onClick)
    container.addEventListener("keydown", onKey)
    return () => {
      container.removeEventListener("click", onClick)
      container.removeEventListener("keydown", onKey)
    }
  }, [links, docPath, openDoc, openNode, containerRef])

  // hover/focus card on resolved and broken doc links (not while the links data loads)
  const resolve = useCallback((el: Element) => {
    const a = el.closest("a")
    const t = a && links && containerRef.current?.contains(a) ? docTarget(a) : null
    if (!a || !t || !links) return null
    const node = links.targets[t.raw]
    if (node) return { anchor: a, target: { path: node.path, kind: node.kind, label: node.label } }
    return isBroken(links, t.raw) ? { anchor: a, target: { broken: t.raw } } : null
  }, [links, containerRef])

  return <LinkPreview containerRef={containerRef} resolve={resolve} />
}
