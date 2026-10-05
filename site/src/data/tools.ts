// The MCP tools for the docs reference, straight from VibeDoc's own definitions (src/lib/mcp-tools.ts),
// so a tool added or changed in the app shows up here on the next site build.
import { TOOLS } from '../../../src/lib/mcp-tools'

interface Schema { type?: string | string[]; description?: string; enum?: readonly unknown[]; items?: Schema; properties?: Record<string, Schema>; required?: readonly string[] }
export interface Param { name: string; type: string; values: string[]; required: boolean; description: string }
export interface Tool { name: string; description: string; params: Param[] }

function typeOf(s: Schema): string {
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(' | ')
  const t = Array.isArray(s.type) ? s.type.join(' | ') : (s.type ?? 'any')
  return t === 'array' && s.items ? `${typeOf(s.items)}[]` : t
}

export const tools: Tool[] = (TOOLS as unknown as { name: string; description: string; inputSchema: Schema }[]).map((t) => {
  const required = new Set(t.inputSchema.required ?? [])
  return {
    name: t.name,
    description: t.description,
    params: Object.entries(t.inputSchema.properties ?? {}).map(([name, s]) => ({
      name, type: typeOf(s), values: (s.enum ?? []).map((v) => JSON.stringify(v)), required: required.has(name), description: s.description ?? '',
    })),
  }
})

/** The first sentence, for the index. */
export const summary = (d: string) => d.split(/(?<=\.)\s/)[0]
