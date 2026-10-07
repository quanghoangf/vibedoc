// Self-check for openapi. Run: node src/lib/openapi.check.mts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { endpointDetail, formatEndpoint, formatEndpointList, listEndpoints, parseOpenApi, resolveRefs, schemaShape, type OpenApiSpec } from './openapi.ts'

const ok = (text: string): OpenApiSpec => {
  const r = parseOpenApi(text)
  if ('error' in r) throw new Error(r.error)
  return r.spec
}

// the example spec (YAML)
const spec = ok(readFileSync(new URL('../../e2e/fixtures/todos-openapi.yaml', import.meta.url), 'utf8'))
assert.deepEqual(listEndpoints(spec).map(e => `${e.method} ${e.path}`), ['GET /todos', 'POST /todos', 'GET /todos/{id}', 'DELETE /todos/{id}', 'GET /health'])
assert.deepEqual(listEndpoints(spec)[0], { method: 'GET', path: '/todos', summary: 'List todos', operationId: 'listTodos', tags: ['todos'] })

// path-level params merged, method any case, $ref + allOf resolved into one object, self-reference stops
const get = endpointDetail(spec, 'get', '/todos/{id}')
assert.ok(get)
assert.deepEqual(get.parameters, [{ name: 'id', in: 'path', required: true, description: 'Todo id', shape: 'string' }])
assert.equal(get.requestBody, null)
assert.deepEqual(get.responses.map(r => r.status), ['200', '404'])
assert.equal(get.responses[0].content[0].type, 'application/json')
assert.equal(get.responses[0].content[0].shape, [
  '{',
  '  title: string',
  '  priority?: "low" | "normal" | "high"',
  '  id: string',
  '  done: boolean',
  '  createdAt?: string(date-time)',
  '  subtasks?: Todo[]',
  '}',
].join('\n'))
const post = endpointDetail(spec, 'POST', '/todos')
assert.ok(post?.requestBody?.required)
assert.match(post.requestBody.content[0].shape, /title: string/)
assert.equal(endpointDetail(spec, 'GET', '/nope'), null)
assert.equal(endpointDetail(spec, 'PATCH', '/todos'), null)

const md = formatEndpoint(get)
assert.match(md, /^## GET \/todos\/\{id\}\nGet one todo\nOperation: getTodo · Tags: todos/)
assert.match(md, /- `id` \(path, required\): string — Todo id/)
assert.match(md, /### Request body\nnone/)
assert.match(md, /#### 404 — No todo with that id\n`application\/json`\n```ts\n\{\n  message: string\n\}\n```/)
assert.match(formatEndpointList(spec, 'openapi.yaml'), /^## Todos API 1\.0\.0 \(openapi\.yaml\)\n\n- GET \/todos — List todos\n/)

// JSON, op-level param overrides path-level, external + missing refs left, escaped pointer
const json = ok(JSON.stringify({
  openapi: '3.1.0',
  paths: {
    '/a/{x}': {
      parameters: [{ name: 'x', in: 'path', schema: { type: 'string' } }],
      put: {
        parameters: [{ name: 'x', in: 'path', schema: { type: 'integer' } }, { name: 'q', in: 'query', schema: { type: ['string', 'null'] } }],
        requestBody: { content: { 'application/json': { schema: { $ref: 'other.yaml#/Thing' } } } },
        responses: { 200: { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/a~1b' } } } }, 500: { $ref: '#/components/responses/Missing' } },
      },
    },
  },
  components: { schemas: { 'a/b': { type: 'object', additionalProperties: { type: 'number' } } } },
}))
const put = endpointDetail(json, 'PUT', '/a/{x}')
assert.ok(put)
assert.deepEqual(put.parameters.map(p => `${p.name}:${p.shape}:${p.required}`), ['x:integer:true', 'q:string | null:false'])
assert.equal(put.requestBody?.content[0].shape, 'other.yaml#/Thing (external, not resolved)')
assert.equal(put.responses[0].content[0].shape, '{\n  [key: string]: number\n}')
assert.deepEqual(put.responses[1], { status: '500', description: '', content: [] })
assert.deepEqual(resolveRefs(json, { $ref: '#/nope' }), { $ref: '#/nope', $missing: true })

// shapes
assert.equal(schemaShape(undefined), 'unknown')
assert.equal(schemaShape({ type: 'array', items: { oneOf: [{ type: 'string' }, { type: 'integer' }] } }), '(string | integer)[]')
assert.equal(schemaShape({ type: 'object' }), 'object')
assert.equal(schemaShape({ type: 'string', nullable: true }), 'string | null')

// refused documents
assert.match((parseOpenApi('swagger: "2.0"\npaths: {}') as { error: string }).error, /Swagger 2\.0 isn't supported/)
assert.match((parseOpenApi('{ nope') as { error: string }).error, /Not valid JSON or YAML/)
assert.match((parseOpenApi('- a\n- b') as { error: string }).error, /expected an object/)
assert.match((parseOpenApi('title: x') as { error: string }).error, /Not an OpenAPI 3\.x document/)

console.log('openapi: ok')

// Try it targets (T502)
const { isLocalUrl, tryTarget, buildTryUrl, NOT_LOCAL } = await import('./openapi.ts')
for (const u of ['http://localhost:3000', 'https://127.0.0.1:8443/api', 'http://[::1]:4010']) assert.ok(isLocalUrl(u), u)
for (const u of ['https://api.example.com', 'http://10.0.0.1', 'http://localhost.evil.com', 'file:///etc/passwd', 'ftp://localhost', 'nope']) assert.ok(!isLocalUrl(u), u)
const withServers = (servers: unknown) => ({ ...spec, servers }) as OpenApiSpec
assert.deepEqual(tryTarget(spec, null), { base: 'http://localhost:4010', start: false })
assert.deepEqual(tryTarget(withServers([{ url: 'https://api.example.com' }]), 'http://localhost:3000'), { base: 'http://localhost:3000', start: true })
assert.deepEqual(tryTarget(withServers([{ url: '/v1' }]), 'http://localhost:3000/'), { base: 'http://localhost:3000/v1', start: true })
assert.deepEqual(tryTarget(withServers([{ url: 'http://localhost:{port}', variables: { port: { default: '9000' } } }]), null), { base: 'http://localhost:9000', start: false })
assert.deepEqual(tryTarget(withServers([{ url: 'https://api.example.com' }]), null), { error: NOT_LOCAL })
assert.deepEqual(tryTarget(withServers(undefined), 'https://app.example.com'), { error: NOT_LOCAL })
assert.deepEqual(buildTryUrl('http://localhost:4010/', '/todos/{id}', { id: 'a b/c' }, { done: 'true', q: '' }), { url: 'http://localhost:4010/todos/a%20b%2Fc?done=true' })
assert.deepEqual(buildTryUrl('http://localhost:4010', '/todos/{id}', {}, {}), { error: 'Missing path parameter "id"' })
assert.deepEqual(buildTryUrl('http://localhost:4010', '@evil.com/x', {}, {}), { error: NOT_LOCAL })
console.log('openapi try: ok')
