// R094: a project's OpenAPI 3.x spec → endpoint list, one endpoint's contract, and its shapes as text.
// Pure (no fs): core.ts reads the file. Only local `$ref`s (`#/...`) are resolved.
// Self-check: node src/lib/openapi.check.mts
import { parse as parseYaml } from 'yaml'

type Obj = Record<string, unknown>
export type OpenApiSpec = Obj & { openapi: string; paths?: Obj; servers?: { url?: string }[]; info?: { title?: string; version?: string } }

export const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const
/** File names VibeDoc treats as the project's spec (anywhere outside node_modules and dot-folders). */
export const OPENAPI_GLOB = '**/openapi.{yaml,yml,json}'

export type Endpoint = { method: string; path: string; summary: string; operationId?: string; tags: string[]; deprecated?: boolean }
export type Param = { name: string; in: string; required: boolean; description: string; shape: string }
export type Content = { type: string; shape: string }
export type EndpointDetail = Endpoint & {
  description: string
  parameters: Param[]
  requestBody: { required: boolean; description: string; content: Content[] } | null
  responses: { status: string; description: string; content: Content[] }[]
}

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

export function parseOpenApi(text: string): { spec: OpenApiSpec } | { error: string } {
  let doc: unknown
  try {
    doc = text.trimStart().startsWith('{') ? JSON.parse(text) : parseYaml(text)
  } catch (e) {
    return { error: `Not valid JSON or YAML: ${(e as Error).message.split('\n')[0]}` }
  }
  if (!isObj(doc)) return { error: 'Not an OpenAPI document (expected an object at the top)' }
  const v = doc.openapi
  if (typeof v !== 'string' || !/^3\./.test(v)) {
    return { error: doc.swagger ? `Swagger ${String(doc.swagger)} isn't supported, only OpenAPI 3.x` : 'Not an OpenAPI 3.x document (no `openapi: 3.x` field)' }
  }
  return { spec: doc as OpenApiSpec }
}

/** JSON pointer lookup for a local ref (`#/components/schemas/Todo`). Undefined when it isn't there. */
function lookup(spec: Obj, ref: string): unknown {
  let node: unknown = spec
  for (const raw of ref.slice(2).split('/')) {
    const key = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~')
    if (!isObj(node) && !Array.isArray(node)) return undefined
    node = (node as Obj)[key]
  }
  return node
}

const refName = (ref: string) => ref.split('/').pop() ?? ref

/**
 * Copy of `node` with local `$ref`s replaced by their target. A ref already being expanded higher up becomes
 * `{ $ref, $circular }`, an external one `{ $ref, $external }`, a missing one `{ $ref, $missing }`.
 */
export function resolveRefs(spec: Obj, node: unknown, chain: string[] = []): unknown {
  if (Array.isArray(node)) return node.map(n => resolveRefs(spec, n, chain))
  if (!isObj(node)) return node
  if (typeof node.$ref === 'string') {
    const ref = node.$ref
    if (!ref.startsWith('#/')) return { $ref: ref, $external: true }
    if (chain.includes(ref)) return { $ref: ref, $circular: true }
    const target = lookup(spec, ref)
    if (target === undefined) return { $ref: ref, $missing: true }
    const resolved = resolveRefs(spec, target, [...chain, ref])
    return isObj(resolved) ? { ...resolved, $refName: refName(ref) } : resolved
  }
  const out: Obj = {}
  for (const [k, v] of Object.entries(node)) out[k] = resolveRefs(spec, v, chain)
  return out
}

function pathItems(spec: OpenApiSpec): [string, Obj][] {
  if (!isObj(spec.paths)) return []
  return Object.entries(spec.paths).map(([p, item]) => [p, resolveRefs(spec, item)] as [string, Obj]).filter(([, item]) => isObj(item))
}

function toEndpoint(path: string, method: string, op: Obj): Endpoint {
  return {
    method: method.toUpperCase(), path, summary: str(op.summary),
    ...(op.operationId ? { operationId: str(op.operationId) } : {}),
    tags: Array.isArray(op.tags) ? op.tags.map(String) : [],
    ...(op.deprecated === true ? { deprecated: true } : {}),
  }
}

/** Every operation, in file order. */
export function listEndpoints(spec: OpenApiSpec): Endpoint[] {
  const out: Endpoint[] = []
  for (const [p, item] of pathItems(spec)) {
    for (const m of HTTP_METHODS) if (isObj(item[m])) out.push(toEndpoint(p, m, item[m] as Obj))
  }
  return out
}

function contents(content: unknown): Content[] {
  if (!isObj(content)) return []
  return Object.entries(content).map(([type, media]) => ({ type, shape: schemaShape(isObj(media) ? media.schema : undefined) }))
}

/** One endpoint's contract with refs resolved and schemas as shape text. Path exact, method any case. Null when absent. */
export function endpointDetail(spec: OpenApiSpec, method: string, path: string): EndpointDetail | null {
  const m = method.toLowerCase()
  const item = pathItems(spec).find(([p]) => p === path)?.[1]
  const op = item && isObj(item[m]) ? (item[m] as Obj) : null
  if (!item || !op) return null
  // Operation-level params override path-level ones with the same name + in
  const params = new Map<string, Obj>()
  for (const p of [...(Array.isArray(item.parameters) ? item.parameters : []), ...(Array.isArray(op.parameters) ? op.parameters : [])]) {
    if (isObj(p) && p.name) params.set(`${str(p.in)}:${str(p.name)}`, p)
  }
  const body = isObj(op.requestBody) ? op.requestBody : null
  return {
    ...toEndpoint(path, m, op),
    description: str(op.description),
    parameters: [...params.values()].map(p => ({
      name: str(p.name), in: str(p.in), required: p.required === true || p.in === 'path', description: str(p.description),
      shape: schemaShape(p.schema ?? (isObj(p.content) ? (Object.values(p.content)[0] as Obj | undefined)?.schema : undefined)),
    })),
    requestBody: body ? { required: body.required === true, description: str(body.description), content: contents(body.content) } : null,
    responses: isObj(op.responses)
      ? Object.entries(op.responses).map(([status, r]) => ({
        status, description: isObj(r) ? str(r.description) : '', content: isObj(r) ? contents(r.content) : [],
      }))
      : [],
  }
}

const pad = (n: number) => '  '.repeat(n)

/** Compact TypeScript-like text for a resolved schema, e.g. `{\n  id: string\n  done?: boolean\n}`. */
export function schemaShape(schema: unknown, depth = 0): string {
  if (!isObj(schema)) return 'unknown'
  if (schema.$circular) return refName(str(schema.$ref))
  if (schema.$external) return `${str(schema.$ref)} (external, not resolved)`
  if (schema.$missing) return `${str(schema.$ref)} (not found)`
  if (depth > 12) return str(schema.$refName) || 'object'
  const nullable = schema.nullable === true ? ' | null' : ''
  if (Array.isArray(schema.enum)) return schema.enum.map(v => JSON.stringify(v)).join(' | ') + nullable
  if ('const' in schema) return JSON.stringify(schema.const)
  // allOf of plain objects (the usual "extends") reads better as one object
  const all = schema.allOf
  if (Array.isArray(all) && all.length && all.every(s => isObj(s) && !s.$circular && !s.$external && !s.$missing && (s.properties || s.type === 'object'))) {
    const parts = all as Obj[]
    return schemaShape({
      ...schema, allOf: undefined, type: 'object',
      properties: Object.assign({}, ...parts.map(p => p.properties ?? {})),
      required: parts.flatMap(p => (Array.isArray(p.required) ? p.required : [])),
    }, depth)
  }
  for (const [key, sep] of [['oneOf', ' | '], ['anyOf', ' | '], ['allOf', ' & ']] as const) {
    const list = schema[key]
    if (Array.isArray(list) && list.length) return list.map(s => schemaShape(s, depth)).join(sep) + nullable
  }
  const type = Array.isArray(schema.type) ? schema.type.map(String) : schema.type ? [String(schema.type)] : []
  if (type.length > 1) return type.map(t => schemaShape({ ...schema, type: t }, depth)).join(' | ')
  const t = type[0] ?? (schema.properties ? 'object' : schema.items ? 'array' : '')
  if (t === 'array') {
    const item = schemaShape(schema.items, depth)
    return (/[|&]/.test(item) ? `(${item})[]` : `${item}[]`) + nullable
  }
  if (t === 'object') {
    const props = isObj(schema.properties) ? Object.entries(schema.properties) : []
    const required = new Set(Array.isArray(schema.required) ? schema.required.map(String) : [])
    const lines = props.map(([k, v]) => `${pad(depth + 1)}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}${required.has(k) ? '' : '?'}: ${schemaShape(v, depth + 1)}`)
    if (isObj(schema.additionalProperties)) lines.push(`${pad(depth + 1)}[key: string]: ${schemaShape(schema.additionalProperties, depth + 1)}`)
    if (!lines.length) return 'object' + nullable
    return `{\n${lines.join('\n')}\n${pad(depth)}}${nullable}`
  }
  if (!t) return 'unknown'
  const format = schema.format ? `(${str(schema.format)})` : ''
  return `${t === 'integer' ? 'integer' : t}${format}${nullable}`
}

const block = (shape: string) => '```ts\n' + shape + '\n```'
const contentLines = (c: Content[]) => c.map(x => `\`${x.type}\`\n${block(x.shape)}`)

/** `vibedoc_get_endpoint` reply for one endpoint. */
export function formatEndpoint(d: EndpointDetail): string {
  const out = [`## ${d.method} ${d.path}${d.deprecated ? ' (deprecated)' : ''}`]
  if (d.summary) out.push(d.summary)
  if (d.description && d.description !== d.summary) out.push(d.description)
  const meta = [d.operationId && `Operation: ${d.operationId}`, d.tags.length && `Tags: ${d.tags.join(', ')}`].filter(Boolean)
  if (meta.length) out.push(meta.join(' · '))
  out.push('', '### Parameters')
  out.push(d.parameters.length
    ? d.parameters.map(p => `- \`${p.name}\` (${p.in}${p.required ? ', required' : ''}): ${p.shape.replace(/\s*\n\s*/g, ' ')}${p.description ? ` — ${p.description}` : ''}`).join('\n')
    : 'none')
  out.push('', `### Request body${d.requestBody?.required ? ' (required)' : ''}`)
  if (!d.requestBody) out.push('none')
  else {
    if (d.requestBody.description) out.push(d.requestBody.description)
    out.push(...contentLines(d.requestBody.content))
  }
  out.push('', '### Responses')
  for (const r of d.responses) {
    out.push(`#### ${r.status}${r.description ? ` — ${r.description}` : ''}`)
    out.push(...contentLines(r.content))
  }
  return out.join('\n')
}

/** Endpoint index: title line, then `GET /todos — summary` per endpoint. */
export function formatEndpointList(spec: OpenApiSpec, path: string): string {
  const title = [spec.info?.title, spec.info?.version].filter(Boolean).join(' ')
  const lines = listEndpoints(spec).map(e => `- ${e.method} ${e.path}${e.summary ? ` — ${e.summary}` : ''}`)
  return [`## ${title || 'API'} (${path})`, '', ...(lines.length ? lines : ['No endpoints.'])].join('\n')
}

// ─── Try it (T502): requests go only to the project's own local app ──────────

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** http(s) on localhost / 127.0.0.1 / [::1] only. */
export function isLocalUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return (u.protocol === 'http:' || u.protocol === 'https:') && LOCAL_HOSTS.has(u.hostname)
  } catch {
    return false
  }
}

export const NOT_LOCAL = "Try it only calls the project's local app (localhost)"

/**
 * Where Try it sends requests: the spec's first server when it is local (a relative one is joined to the app URL,
 * `{variables}` take their defaults), else the frontend app's URL, which the caller starts (`start`). Never a remote host.
 */
export function tryTarget(spec: OpenApiSpec, appUrl: string | null): { base: string; start: boolean } | { error: string } {
  const server = spec.servers?.[0]
  let url = typeof server?.url === 'string' ? server.url : ''
  const vars = isObj((server as Obj | undefined)?.variables) ? ((server as Obj).variables as Obj) : {}
  url = url.replace(/\{([^}]+)\}/g, (m, name: string) => {
    const v = vars[name]
    return isObj(v) && v.default != null ? String(v.default) : m
  })
  if (url && isLocalUrl(url)) return { base: url, start: false }
  const app = appUrl && isLocalUrl(appUrl) ? appUrl : null
  if (app) return { base: url.startsWith('/') ? app.replace(/\/+$/, '') + url : app, start: true }
  return { error: NOT_LOCAL }
}

/** Full request URL: `{name}` path params filled (all required), empty query values dropped. Refuses a non-local result. */
export function buildTryUrl(base: string, path: string, params: Record<string, string>, query: Record<string, string>): { url: string } | { error: string } {
  let missing = ''
  const filled = path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const v = params[name]
    if (v == null || v === '') missing ||= name
    return encodeURIComponent(v ?? '')
  })
  if (missing) return { error: `Missing path parameter "${missing}"` }
  let u: URL
  try {
    u = new URL(base.replace(/\/+$/, '') + filled)
  } catch {
    return { error: `Not a valid URL: ${base}${filled}` }
  }
  for (const [k, v] of Object.entries(query)) if (v !== '') u.searchParams.append(k, v)
  return isLocalUrl(u.href) ? { url: u.href } : { error: NOT_LOCAL }
}
