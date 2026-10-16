// Since T529 the hub refuses a `?root=` it doesn't know: a spec that builds its own temp project registers it first,
// the way the `vibedoc` CLI does (R100), so it never writes to the real ~/.vibedoc (the server's VIBEDOC_HOME is used).
/** → the project's hub id (a spec that mocks /api/projects must use it: per-project state is keyed by it). */
export async function registerFixture(base: string, root: string): Promise<string> {
  const res = await fetch(`${base}/api/projects/add`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-vibedoc-cli': '1' },
    body: JSON.stringify({ root }),
  })
  if (!res.ok) throw new Error(`registering ${root} in the hub failed: ${res.status} ${await res.text()}`)
  return (await res.json()).id
}
