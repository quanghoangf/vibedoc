# T006: Task Creation Form
**Status:** ❌ Cancelled
**Phase:** 2 — Create from UI
**Size:** M (3-4 hrs)
**Depends on:** T003

## What to build
A modal form to create new tasks from the UI. Fills in the standard task template and writes a new `T00N-*.md` file.

## Scope
- [ ] "New Task" button in Board tab header
- [ ] Modal form: title, phase, size, description (textarea), depends-on
- [ ] Auto-number: scan existing tasks, pick next T00N
- [ ] On submit: `POST /api/tasks/create` → writes `plans/tasks/T00N-slug.md`
- [ ] New task appears in `todo` column immediately
- [ ] Emits SSE event → activity feed shows "New task created"

## New API route needed
`POST /api/tasks/create`
```typescript
// Body: { title, phase, size, description, dependsOn, root }
// Writes plans/tasks/T00N-slug.md
// Returns: { task }
```

## New core.ts function
```typescript
export async function createTask(params: CreateTaskParams, root: string): Promise<Task>
```

## File template output
```markdown
# T004: [Title]
**Status:** 📋 Ready
**Phase:** [phase]
**Size:** [size]
**Depends on:** [dependsOn or —]

## What to build
[description]

## Scope
- [ ] [item 1]

## Acceptance criteria
- [ ] [criterion 1]

## Definition of done
[when is this done?]
```

## Acceptance criteria
- [ ] "New Task" button opens modal
- [ ] Form validates: title required
- [ ] Correct task number auto-assigned (no collision)
- [ ] File written to `plans/tasks/`
- [ ] Task appears in todo column without page refresh
- [ ] `npm run build` passes

## Definition of done
Click New Task → fill form → submit → new card appears in Todo column.
