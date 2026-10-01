"use client"

import { memo, useEffect, useMemo, useRef, type RefObject } from "react"
import { useRouter } from "next/navigation"
import { marked } from "marked"
import { cn } from "@/lib/utils"
import { stripFrontmatter } from "@/lib/doc-priority"
import { useApp } from "@/context/AppContext"
import { useOpenNode } from "@/components/memory/EntryRelated"
import { toast } from "@/components/ui/toast"
import { useDocLinks, type DocLinksData } from "./useDocLinks"

// Configure marked for GitHub Flavored Markdown
marked.setOptions({
  gfm: true,
  breaks: false,
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

interface MarkdownRendererProps {
  content: string
  className?: string
  /** ms timestamp of the last agent edit; top-level blocks that change within HIGHLIGHT_WINDOW of it get marked */
  highlightSince?: number
  /** The doc being shown (docs preview only): makes its .md links and [[wikilinks]] open inside VibeDoc */
  docPath?: string
}

// The agent's edit lands a moment after its SSE event (span apply or a fetch of the whole file)
const HIGHLIGHT_WINDOW = 3000

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className, highlightSince = 0, docPath }: MarkdownRendererProps) {
  // Frontmatter is metadata (e.g. a doc's priority), never body text
  const html = useMemo(() => sanitize(marked.parse(stripFrontmatter(content)) as string), [content])
  const containerRef = useRef<HTMLDivElement>(null)
  const prevBlocksRef = useRef<string[] | null>(null)

  // Mark blocks that weren't in the previous render (multiset match, so moved or duplicated blocks don't count).
  // Runs before mermaid replaces its divs, so both renders are compared as raw markup.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const blocks = Array.from(container.children)
    // data-broken comes and goes with the links data (DocLinks), not with the content
    const sigs = blocks.map((b) => b.outerHTML.replaceAll(' data-broken=""', ""))
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

    // Debounce so rapid keystrokes (live preview) don't thrash mermaid
    const timer = setTimeout(() => {
      if (cancelled) return
      import("mermaid").then((m) => {
        if (cancelled || !container.isConnected) return
        // Query AFTER the async import resolves — gets current DOM, not stale snapshot
        const nodes = Array.from(
          container.querySelectorAll<HTMLElement>(".mermaid:not([data-processed])")
        )
        if (nodes.length === 0) return
        const dark = document.documentElement.classList.contains("dark")
        m.default.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral", darkMode: dark, securityLevel: "antiscript" })
        // Do NOT suppress errors — suppressing causes mermaid to silently revert
        // the diagram element back to showing raw source text on parse failure.
        m.default.run({ nodes }).catch((e) => { console.error("[mermaid]", e) })
      })
    }, 120)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [html])

  return (
    <>
      <div
        ref={containerRef}
        className={cn("prose-dark", className)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {docPath && <DocLinks docPath={docPath} html={html} containerRef={containerRef} />}
    </>
  )
})

const EXTERNAL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

/** Same slug rule as the heading renderer above; idempotent on a slug that is already one. */
const slug = (h: string) => {
  let t = h
  try { t = decodeURIComponent(h) } catch { /* keep it raw */ }
  return t.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-")
}

/** Scroll to a heading; retries while a just-opened doc renders. */
function scrollToHeading(hash: string, tries = 15) {
  const el = document.getElementById(slug(hash))
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
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

const isBroken = (links: DocLinksData, raw: string) => !links.targets[raw] && links.broken.some((b) => b.path === raw)

/**
 * Link handling for the docs preview (R056): one delegated click listener on the rendered doc, and
 * data-broken on links the links API lists as broken. Kept out of MarkdownRenderer so its other users
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
    marked.forEach((a) => a.setAttribute("data-broken", ""))
    return () => marked.forEach((a) => a.removeAttribute("data-broken"))
  }, [html, links, containerRef])

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
        toast(`Not found: ${t.raw}`)
        return
      }
      if (node.path === docPath) {
        if (t.hash) scrollToHeading(t.hash)
        return
      }
      if (node.kind === "doc" || node.kind === "adr") {
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

  return null
}
