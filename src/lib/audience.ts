// R087: notes written only for agents or only for humans, inside one markdown doc.
//   <!-- agent-only … -->                            hidden in the viewer (a comment), unwrapped for agents
//   <!-- human-only:start --> … <!-- human-only:end -->  shown in the viewer, removed for agents
// Markers inside ``` / ~~~ fences are text, never applied. Pure: no fs, no imports.

const FENCE = /^\s*(```|~~~)/
const AGENT_OPEN = /<!--\s*agent-only\b/
const HUMAN_START = /<!--\s*human-only:start\s*-->/
const HUMAN_END = /<!--\s*human-only:end\s*-->/

/** The doc as an agent should read it: agent-only notes unwrapped, human-only blocks (markers included) removed. */
export function forAgent(md: string): string {
  const out: string[] = []
  let inFence = false
  let inHuman = false
  let inAgent = false
  const push = (s: string, wasMarked: boolean) => { if (!wasMarked || s.trim()) out.push(wasMarked ? s.trimEnd() : s) }

  for (const line of md.split('\n')) {
    if (inHuman) {
      const end = line.match(HUMAN_END)
      if (end && !inFence) {
        inHuman = false
        const rest = line.slice((end.index ?? 0) + end[0].length)
        if (rest.trim()) out.push(...prose(rest))
      } else if (FENCE.test(line)) inFence = !inFence
      continue
    }
    if (inAgent) {
      const close = line.indexOf('-->')
      if (close < 0) { out.push(line); continue }
      inAgent = false
      push(line.slice(0, close), true)
      const rest = line.slice(close + 3)
      if (rest.trim()) out.push(...prose(rest))
      continue
    }
    if (FENCE.test(line)) { inFence = !inFence; out.push(line); continue }
    if (inFence) { out.push(line); continue }
    out.push(...prose(line))
  }
  return out.join('\n')

  /** One prose line (or the rest of one): applies the markers it contains, may open a block. */
  function prose(line: string): string[] {
    const hs = line.match(HUMAN_START)
    const ao = line.match(AGENT_OPEN)
    if (hs && (!ao || (hs.index ?? 0) < (ao.index ?? 0))) {
      const before = line.slice(0, hs.index)
      const after = line.slice((hs.index ?? 0) + hs[0].length)
      const end = after.match(HUMAN_END)
      if (!end) {
        const head = before.trim() ? prose(before) : []
        inHuman = true
        return head
      }
      const joined = before + after.slice((end.index ?? 0) + end[0].length)
      return joined.trim() ? prose(joined) : []
    }
    if (ao) {
      const before = line.slice(0, ao.index)
      const after = line.slice((ao.index ?? 0) + ao[0].length)
      const close = after.indexOf('-->')
      if (close < 0) {
        inAgent = true
        return [before + after.trim()].filter((s) => s.trim())
      }
      const joined = before + after.slice(0, close).trim() + after.slice(close + 3)
      // the joined line may hold another marker
      return joined.trim() ? prose(joined) : []
    }
    return [line]
  }
}
