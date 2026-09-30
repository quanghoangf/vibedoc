/** Inline markdown → the text a reader sees: links and images keep their label, code/emphasis marks and tags drop. */
export function plainInline(md: string): string {
  return md
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[`*]|~~/g, "")
    .trim()
}

export function extractHeadings(content: string): { level: number; text: string; anchor: string }[] {
  return content
    .split('\n')
    .filter(line => /^#{1,3} /.test(line))
    .flatMap(line => {
      const match = line.match(/^(#{1,3}) (.+)/)
      if (!match) return []
      const text = plainInline(match[2])
      const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      return [{ level: match[1].length, text, anchor }]
    })
}

/** The doc's opening `# H1` (the docs preview hides that same H1 and the header shows it) plus reading stats. */
export function docStats(content: string): { title: string | null; words: number; sections: number; minutes: number } {
  const prose = content.replace(/^```[\s\S]*?^```/gm, "")
  const h1 = plainInline(/^# (.+)/.exec(content.trimStart().split("\n", 1)[0])?.[1] ?? "")
  const words = prose.split(/\s+/).filter((w) => /\w/.test(w)).length
  return {
    title: h1 || null,
    words,
    sections: (prose.match(/^## /gm) ?? []).length,
    minutes: Math.max(1, Math.round(words / 220)),
  }
}
