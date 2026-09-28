// Self-check for roadmap-import. Run: node src/lib/roadmap-import.check.mts
import assert from 'node:assert/strict'
import { roadmapFromMarkdown, roadmapFromTasks, starterRoadmap } from './roadmap-import.ts'

const md = `# Project Roadmap

Intro text that belongs to no section.

## v1.x — Shipped

The full v1 feature set.

- **Kanban board** — task cards, columns
- Docs viewer with [markdown](https://x.y) rendering

---

## Near-term

- **Drag-and-drop** — drag cards
  between columns
  - with optimistic update
- [x] Version flag
- [ ] Depth limit

## Empty section

Just prose, no bullets.

### Sub heading ends the section
- not a feature
`

const d = roadmapFromMarkdown(md)
const horizons = d.filter(x => x.parent === null)
assert.deepEqual(horizons.map(h => h.title), ['v1.x — Shipped', 'Near-term'], 'sections without bullets are skipped')
const [shipped, near] = horizons
assert.equal(shipped.status, 'done')
assert.equal(shipped.body, 'The full v1 feature set.')
const kids = (k: string) => d.filter(x => x.parent === k)
assert.deepEqual(kids(shipped.key).map(f => [f.title, f.status, f.body]), [
  ['Kanban board', 'done', 'task cards, columns'],
  ['Docs viewer with markdown rendering', 'done', ''],
])
const nearKids = kids(near.key)
assert.deepEqual(nearKids.map(f => [f.title, f.status]), [
  ['Drag-and-drop', 'planned'], ['Version flag', 'done'], ['Depth limit', 'planned'],
])
assert.equal(nearKids[0].body, 'drag cards\nbetween columns\n- with optimistic update')
assert.equal(near.status, 'in-progress', 'one done child rolls the horizon up to in-progress')
assert.ok(!d.some(x => x.title === 'not a feature'), 'H3 closes the section')

const t = roadmapFromTasks([
  { id: 'T003', title: 'C', status: 'in-progress', phase: '2 — Build' },
  { id: 'T001', title: 'A', status: 'done', phase: '1 — Polish' },
  { id: 'T002', title: 'B', status: 'cancelled', phase: '1 — Polish' },
  { id: 'T004', title: 'D', status: 'todo', phase: 'UI Polish' },
  { id: 'T005', title: 'E', status: 'todo', phase: '—' },
])
assert.deepEqual(t.filter(x => x.parent === null).map(h => [h.title, h.status]), [
  ['1 — Polish', 'done'], ['2 — Build', 'in-progress'], ['UI Polish', 'planned'], ['Unphased', 'planned'],
])
assert.ok(!t.some(x => x.tasks.includes('T002')), 'cancelled tasks are skipped')
assert.deepEqual(t.find(x => x.tasks[0] === 'T003')?.status, 'in-progress')

assert.deepEqual(starterRoadmap().map(h => h.title), ['Shipped', 'Now', 'Next', 'Later'])
console.log('roadmap-import: ok')
