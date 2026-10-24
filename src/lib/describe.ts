// Pure: a file's one-line description for /explorer. No React, no fs.

const MAX = 160

/** Inline markdown → plain text: links and images keep their text, emphasis / code marks and HTML tags go. */
export function plainInline(md: string): string {
  return md
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t: string, alias?: string) => alias ?? t)
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|__|~~)(\S(?:.*?\S)?)\1/g, '$2')
    .replace(/(^|\W)[*_](\S(?:.*?\S)?)[*_](?=\W|$)/g, '$1$2')
    .replace(/`+([^`]*)`+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The first sentence of `text` (up to . ! or ? before a space or the end), capped at MAX characters. */
function firstSentence(text: string): string {
  const m = /^.*?[.!?](?=\s|$)/.exec(text)
  const s = (m ? m[0] : text).trim()
  return s.length > MAX ? `${s.slice(0, MAX - 1).trimEnd()}…` : s
}

/**
 * The first prose sentence of a markdown file, as plain text: frontmatter, HTML comments, code fences, headings,
 * tables, lists, rules and code-comment prefixes (`//`, `#`, `/*`, ` * `) are skipped or stripped; link syntax keeps
 * its text. Falls back to the first heading, else ''.
 */
export function firstProseSentence(content: string): string {
  return firstProse(content, firstSentence)
}

/** The whole first prose paragraph (same skipping as firstProseSentence), capped at `max` characters; '' when none. */
export function firstProseParagraph(content: string, max = 600): string {
  return firstProse(content, (s) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s), false)
}

function firstProse(content: string, pick: (paragraph: string) => string, headingFallback = true): string {
  const text = content
    .replace(/^﻿/, '')
    .replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '')
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
  let heading = ''
  let fence: string | null = null
  let para: string[] = []
  const done = () => {
    const p = plainInline(para.join(' '))
    para = []
    return p.length >= 20 && /[a-z]/i.test(p) ? pick(p) : ''
  }
  for (const raw of text.split(/\r?\n/)) {
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(raw)?.[1]
    if (f && (!fence || (f[0] === fence[0] && f.length >= fence.length))) { fence = fence ? null : f; continue }
    if (fence) continue
    const line = raw.trim()
    const h = /^#{1,6}\s+(.+?)\s*#*$/.exec(line)
    if (h) {
      if (!heading) heading = plainInline(h[1])
      const p = done()
      if (p) return p
      continue
    }
    // block markup that isn't prose
    if (!line || /^(\||[-*+]\s|\d+[.)]\s|>?\s*\[!|[-*_=]{3,}$|<\/?[a-z][^>]*>$)/i.test(line)) {
      const p = done()
      if (p) return p
      continue
    }
    // a blockquote's text counts; a code comment's prefix goes
    para.push(line.replace(/^(>\s*)+/, '').replace(/^(\/\/+|\/\*+|\*\/|\*(?=\s)|#!?(?=\s))\s*/, '').replace(/\s*\*\/$/, ''))
  }
  return done() || (headingFallback ? heading : '')
}

export type InlinePart =
  | { kind: 'text' | 'code' | 'strong' | 'em'; text: string }
  | { kind: 'link'; text: string; href: string }

/** Inline markdown → parts to render as React nodes (code, **strong**, *em*, [links](url)); no HTML is ever built. */
export function inlineParts(md: string): InlinePart[] {
  const out: InlinePart[] = []
  const re = /`([^`]+)`|\*\*(\S(?:.*?\S)?)\*\*|(?<![\w*])[*_](\S(?:.*?\S)?)[*_](?![\w*])|\[([^\]]+)\]\(([^)\s]+)\)/g
  let at = 0
  for (let m: RegExpExecArray | null; (m = re.exec(md));) {
    if (m.index > at) out.push({ kind: 'text', text: md.slice(at, m.index) })
    if (m[1] !== undefined) out.push({ kind: 'code', text: m[1] })
    else if (m[2] !== undefined) out.push({ kind: 'strong', text: m[2] })
    else if (m[3] !== undefined) out.push({ kind: 'em', text: m[3] })
    else out.push({ kind: 'link', text: m[4], href: m[5] })
    at = m.index + m[0].length
  }
  if (at < md.length) out.push({ kind: 'text', text: md.slice(at) })
  return out
}
