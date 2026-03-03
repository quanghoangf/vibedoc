# T022 — Agent Config View
**Status:** 📋 Ready
**Phase:** 3 — Doc Management
**Size:** XS (30 min)
**Depends on:** —

## What to build
Pin `CLAUDE.md` and `AGENTS.md` files at the top of the `DocList` sidebar in a dedicated "Agent Config" section with a visual badge so they are always easy to find. These are the AI instruction files that control vibe coding behavior and deserve first-class visibility.

## Scope
- [ ] Filter the `docs` prop in `DocList` for entries whose path ends in `CLAUDE.md` or `AGENTS.md` (case-insensitive, at any depth)
- [ ] Render a pinned "Agent Config" section above the main file tree with a `Bot` icon (lucide-react) and an amber "AI Config" badge
- [ ] Each entry in the pinned section is clickable — calls `onDocClick` same as the normal file list
- [ ] Highlight active selection (same as regular file entries)
- [ ] Section only renders when at least one agent config file exists in the project

## Files to touch
- `src/components/docs/DocList.tsx` — only file that changes

## Key implementation detail
No new API call is needed. The `CLAUDE.md` / `AGENTS.md` files already appear in the `docs` prop fetched by `docs/page.tsx`. Filter them client-side:
```typescript
const agentConfigs = docs.filter(d => {
  const p = d.path.replace(/\\/g, '/')
  return p === 'CLAUDE.md' || p === 'AGENTS.md' ||
         p.endsWith('/CLAUDE.md') || p.endsWith('/AGENTS.md')
})
```

## Acceptance criteria
- [ ] Opening the Docs tab on this project shows `CLAUDE.md` pinned at the top under "Agent Config"
- [ ] Clicking it opens it in the editor
- [ ] Active highlight works correctly for pinned entries
- [ ] If no `CLAUDE.md` / `AGENTS.md` exist, the "Agent Config" section is completely hidden
- [ ] `pnpm build` passes

## Definition of done
CLAUDE.md appears pinned with a Bot icon at the top of the docs sidebar. Clicking it opens it in the editor.
