export type DiffLine = { op: " " | "+" | "-"; text: string }

// ponytail: O(n·m) LCS on the changed middle; fine for docs, swap for Myers if huge files show up.
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n")
  const b = after.split("\n")
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB-- }

  const x = a.slice(start, endA)
  const y = b.slice(start, endB)
  // lcs[i][j] = LCS length of x[i..] and y[j..]
  const lcs = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0))
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) {
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const middle: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) { middle.push({ op: " ", text: x[i] }); i++; j++ }
    else if (i < x.length && (j === y.length || lcs[i + 1][j] >= lcs[i][j + 1])) { middle.push({ op: "-", text: x[i] }); i++ }
    else { middle.push({ op: "+", text: y[j] }); j++ }
  }

  return [
    ...a.slice(0, start).map((text) => ({ op: " " as const, text })),
    ...middle,
    ...a.slice(endA).map((text) => ({ op: " " as const, text })),
  ]
}

const CONTEXT = 2

// Keep changed lines plus CONTEXT lines around them; collapse the rest into a count.
export function visibleHunks(lines: DiffLine[]): (DiffLine | number)[] {
  const keep = lines.map(() => false)
  lines.forEach((l, i) => {
    if (l.op === " ") return
    for (let k = Math.max(0, i - CONTEXT); k <= Math.min(lines.length - 1, i + CONTEXT); k++) keep[k] = true
  })
  const out: (DiffLine | number)[] = []
  lines.forEach((l, i) => {
    if (keep[i]) out.push(l)
    else if (typeof out[out.length - 1] === "number") out[out.length - 1] = (out[out.length - 1] as number) + 1
    else out.push(1)
  })
  return out
}

export type TextEdit = { old_string: string; new_string: string }

// Same contract as Claude Code's Edit tool: each old_string must match exactly once, applied in order.
// An empty old_string is only allowed on an empty/new file (write the first content).
export function applyEdits(text: string, edits: TextEdit[]): { content: string } | { error: string } {
  let content = text
  for (const [i, e] of edits.entries()) {
    if (typeof e?.old_string !== "string" || typeof e?.new_string !== "string") {
      return { error: `Edit ${i + 1}: old_string and new_string must be strings` }
    }
    if (e.old_string === "") {
      if (content !== "") return { error: `Edit ${i + 1}: empty old_string is only allowed for a new, empty doc` }
      content = e.new_string
      continue
    }
    const at = content.indexOf(e.old_string)
    if (at === -1) return { error: `Edit ${i + 1}: old_string not found in the doc` }
    if (content.indexOf(e.old_string, at + 1) !== -1) {
      return { error: `Edit ${i + 1}: old_string matches more than once; include more surrounding text` }
    }
    content = content.slice(0, at) + e.new_string + content.slice(at + e.old_string.length)
  }
  return { content }
}
