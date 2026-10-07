// The MCP tool definitions (name, description, input schema) served by /api/mcp tools/list.
// Its own module so the docs site (site/, R074) generates one page per tool from the same list.
// Relative imports without extension so both Next and the site's Vite resolve them.
import { ENTRY_TYPES } from "./entries";
import { SEVERITIES } from "./verification";
import { PRIORITIES } from "./doc-priority";

export const MEMORY_SOURCES = ["claude-code"] as const; // R052: Cursor / Cline importers are out of scope

export const TOOLS = [
  {
    name: "vibedoc_get_status",
    description:
      "Get project status overview: active tasks, blockers, doc count, memory. Call this at session start.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "vibedoc_get_frontend",
    description:
      "The project's web frontend app (R057): dir, framework, start command, URL, whether it was detected or set in Settings, Playwright and auth state. Call before writing or running browser tests.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "vibedoc_get_sessions",
    description:
      "Agent and human sessions grouped from the activity log, newest first: who, when, tasks moved, docs changed, ADRs. Call at session start to see what happened recently.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max sessions to return (default 10)" },
        taskId: { type: "string", description: 'Only sessions that moved this task, e.g. "T003"' },
        since: { type: "string", description: "ISO timestamp; only sessions that ended at or after it" },
      },
      required: [],
    },
  },
  {
    name: "vibedoc_list_specs",
    description:
      "List the project's capability specs (docs/specs/<capability>.md): what each capability does today, as requirements with WHEN/THEN scenarios. One line per spec: slug, title, requirement and scenario counts. Read one with vibedoc_get_spec.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "vibedoc_get_spec",
    description:
      "Read one capability spec: the whole file, or only one requirement with its scenarios. Check it before changing that capability's behaviour.",
    inputSchema: {
      type: "object",
      properties: {
        capability: { type: "string", description: 'Spec slug, e.g. "board-views" (docs/specs/board-views.md)' },
        requirement: { type: "string", description: "Requirement name (case-insensitive); omit for the whole spec" },
      },
      required: ["capability"],
    },
  },
  {
    name: "vibedoc_spec_context",
    description:
      "Gather what the project already says about one capability so you can draft its spec: matching epics (or the ones you pass) with their done tasks' Goal and Acceptance criteria, related docs, knowledge entries and the existing spec. Read-only, capped at ~6k tokens (oldest tasks cut first). Draft the spec from it and propose it with vibedoc_propose_edit at docs/specs/<capability>.md; never write it directly.",
    inputSchema: {
      type: "object",
      properties: {
        capability: { type: "string", description: 'Spec slug, e.g. "board-views"' },
        epics: { type: "array", items: { type: "string" }, description: "Epic ids to use instead of keyword matching, e.g. [\"R010\", \"R022\"]" },
        query: { type: "string", description: "Words to match epics, docs and entries by (default: the slug's words)" },
      },
      required: ["capability"],
    },
  },
  {
    name: "vibedoc_get_endpoint",
    description:
      "Look up one HTTP endpoint in the project's OpenAPI 3.x spec (openapi.yaml / openapi.yml / openapi.json): parameters, request body and response shapes, with local $refs resolved. Call it before calling or changing that endpoint. Without method + path (or for an unknown one) it lists every endpoint.",
    inputSchema: {
      type: "object",
      properties: {
        method: { type: "string", description: 'HTTP method, e.g. "GET"' },
        path: { type: "string", description: 'Path exactly as in the spec, e.g. "/todos/{id}"' },
      },
      required: [],
    },
  },
  {
    name: "vibedoc_read_doc",
    description:
      'Read a doc file by name. Starts with one `> path · priority · last edit · inbound links` line (off with `docs.agentHeader: false` in .vibedoc/settings.json); a wrong name lists up to 5 similar docs. Use: "CLAUDE", "HLD", "EVENT_CATALOG", "MEMORY", "user-service/API", "ADR-001". Ends with a "## Related files" footer when the doc has links: what it links to, what links to it (docs by path; tasks, epics, entries, ADRs by id) broken links ([x](y.md) / [[y]] to no file) and stale paths (backticked paths to missing files), so you know what to read next. You get the agent view: `<!-- agent-only … -->` notes are shown, `<!-- human-only:start/end -->` blocks are removed (so an edit can\'t match text inside them).',
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: 'Doc name, e.g. "CLAUDE", "HLD", "user-service/API"',
        },
      },
      required: ["query"],
    },
  },
  {
    name: "vibedoc_list_docs",
    description:
      "List all documentation files grouped by section, with each doc's priority (P0 highest) when set. Use to discover what docs exist.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "vibedoc_set_doc_priority",
    description:
      'Set a doc\'s priority (P0 highest … P3 lowest), or clear it with null. Stored as `priority:` in the doc\'s frontmatter; nothing else in the file changes.',
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: 'Relative path from project root, e.g. "docs/api/my-guide.md"' },
        priority: { type: ["string", "null"], enum: [...PRIORITIES, null], description: "P0, P1, P2, P3, or null to clear" },
      },
      required: ["path", "priority"],
    },
  },
  {
    name: "vibedoc_search_docs",
    description:
      "Full-text search across all docs. Returns files and line snippets.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Search term" } },
      required: ["query"],
    },
  },
  {
    name: "vibedoc_check_docs",
    description:
      "Lint the project's docs (.md files): broken links, stale backticked paths, unparseable frontmatter, no H1 title, empty docs, orphan docs, capability spec structure, epic `## Spec changes` that wouldn't merge, and docs that may be outdated (they name a path a done task's commits renamed or deleted; the issue names the task and the new path). Returns issues grouped by file with level (error / warn), rule and line; a clean project says so in one line. Pass `path` to check one file, e.g. after editing it, and fix its errors before marking a docs task done.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "Optional: one file to check (relative to the project root)" } },
    },
  },
  {
    name: "vibedoc_write_doc",
    description:
      'Write or create a documentation file. Use to add new docs or update existing ones. Path is relative to project root (e.g., "docs/api/endpoints.md"). Creates parent directories as needed. Triggers real-time browser update so the user can review.',
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            'Relative path from project root, e.g. "docs/api/my-guide.md"',
        },
        content: {
          type: "string",
          description: "Full markdown content to write",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "vibedoc_list_tasks",
    description:
      "List all tasks as a kanban board. Filter by status optionally.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["all", "todo", "in-progress", "review", "blocked", "paused", "done", "cancelled"],
        },
      },
      required: [],
    },
  },
  {
    name: "vibedoc_get_task",
    description:
      "Read a specific task file including scope, criteria, and definition of done.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: 'e.g. "T001", "T003"' },
      },
      required: ["taskId"],
    },
  },
  {
    name: "vibedoc_get_attachment",
    description:
      "See an image attached to a task (a screenshot the user pasted): returns the image itself. Paths look like plans/tasks/assets/T512/1.png or plans/tasks/assets/draft-…/1.png; a task body links them as ![](assets/…), relative to plans/tasks/. PNG, JPEG, WebP or GIF inside the project only.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: 'Project-relative, e.g. "plans/tasks/assets/T512/1.png"' },
      },
      required: ["path"],
    },
  },
  {
    name: "vibedoc_get_evidence",
    description:
      "Read a task's evidence doc: every checklist item with what its Playwright run proved (passed / failed with the error / missing / manual), screenshot file paths, the run's time, commit and video, and the history of kept runs.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: 'e.g. "T138"' },
        runId: { type: "string", description: "A kept run to detail instead of the newest, e.g. \"20261004T074314Z\"" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "vibedoc_verify_context",
    description:
      "Everything needed to check a finished task against what was asked: its Goal, Scope and Acceptance criteria, the epic's Done when, the related capability spec, project conventions, and the diff of the commits that name the task (capped at ~2000 lines), plus how to report. Then call vibedoc_report_findings.",
    inputSchema: {
      type: "object",
      properties: { taskId: { type: "string", description: "e.g. T156" } },
      required: ["taskId"],
    },
  },
  {
    name: "vibedoc_report_findings",
    description:
      "Record what a finished task gets wrong against what was asked: each finding names the acceptance criterion, scope item or rule it fails. Saved as the task's `## Verification` section (a new report replaces the old one) and shown to the human on the task. [] = verified, nothing found.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "e.g. T012" },
        findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: [...SEVERITIES], description: "critical = a criterion is not met; major = met only partly or with a bug; minor = small gap" },
              criterion: { type: "string", description: 'What it fails, quoted short, e.g. AC2 "Unknown plan → 400"' },
              message: { type: "string", description: "What is missing or wrong, one line" },
              file: { type: "string", description: 'Where, e.g. "src/app/api/checkout/route.ts:41"' },
            },
            required: ["severity", "criterion", "message"],
          },
        },
        sha: { type: "string", description: "The commit you checked (git rev-parse --short HEAD)" },
      },
      required: ["taskId", "findings"],
    },
  },
  {
    name: "vibedoc_update_task",
    description:
      "Update task status. Call when starting, finishing, or blocking a task. UI updates in real time. " +
      "When moving a task to done, include manualTests: a checklist of what a human should click through to trust it, " +
      "written from what you actually changed. If items are left for a human (manual ones, or 🤖 ones no passing run proved), " +
      "the task lands in review instead of done; that is expected: carry on, its dependents can still start.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        status: {
          type: "string",
          enum: ["todo", "in-progress", "review", "done", "blocked", "paused", "cancelled"],
        },
        manualTests: {
          type: "string",
          description:
            "Optional manual test report, saved as the task's `## Manual tests` section (replaces an older one). Markdown checklist: " +
            "`### Steps` items as `- [ ] <what to do> → <what you should see>`, then `### Regression risk` items for existing features worth re-checking. " +
            "Plain lines become unticked steps. Prefix an item with `🤖 ` (`- [ ] 🤖 Open / → board loads`) when a Playwright spec covers it.",
        },
        spec: {
          type: "string",
          description:
            "Optional Playwright spec covering the 🤖 items, a path relative to the repo root (e.g. `e2e/vibedoc/T145-foo.spec.ts`). " +
            "Written in the manual tests header. Without manualTests it updates the existing section's header only.",
        },
        autoResult: {
          type: "string",
          enum: ["passed", "failed"],
          description: "Optional result of the spec's last run (dated today). Without manualTests it updates the existing section's header only.",
        },
        agent: {
          type: "string",
          description: 'Your name as the owner of the task, e.g. "claude" (defaults to the MCP client\'s name). Starting a task makes you its owner.',
        },
      },
      required: ["taskId", "status"],
    },
  },
  {
    name: "vibedoc_next_task",
    description:
      "Claim the next ready task of an epic (deps done, not taken) and move it to in-progress. Call again after marking it done.",
    inputSchema: {
      type: "object",
      properties: {
        epic: { type: "string", description: 'Epic roadmap id, e.g. "R037"' },
        agent: {
          type: "string",
          description: 'Your name as the owner of the task, e.g. "claude" (defaults to the MCP client\'s name). Starting a task makes you its owner.',
        },
      },
      required: ["epic"],
    },
  },
  {
    name: "vibedoc_log_decision",
    description:
      "Write a new Architecture Decision Record (ADR) when making a technical decision.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        context: { type: "string" },
        decision: { type: "string" },
        rationale: { type: "string" },
        alternatives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              option: { type: "string" },
              reason: { type: "string" },
            },
          },
        },
        consequences: { type: "string" },
      },
      required: ["title", "context", "decision"],
    },
  },
  {
    name: "vibedoc_read_memory",
    description:
      "Read MEMORY.md — the session handoff file. Always call this at session start. If it shows '## ⚠ Memory warnings' (the handoff contradicts the board), fix the handoff with vibedoc_update_memory before starting work.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "vibedoc_update_memory",
    description:
      "Update MEMORY.md with session summary. Call at END of every session. Only the sections you pass are rewritten; other sections (including hand-written ones) are kept. Durable facts (conventions, gotchas, decisions, preferences) go to vibedoc_save_entry, not the handoff.",
    inputSchema: {
      type: "object",
      properties: {
        currentState: { type: "string" },
        justCompleted: { type: "array", items: { type: "string" } },
        workingOn: { type: "string" },
        upNext: { type: "array", items: { type: "string" } },
        issues: {
          type: "array",
          items: {
            oneOf: [
              { type: "string" },
              { type: "object", properties: { issue: { type: "string" }, severity: { type: "string" }, status: { type: "string" } }, required: ["issue"] },
            ],
          },
        },
        decisions: { type: "array", items: { type: "string" } },
        techDebt: { type: "array", items: { type: "string" } },
        handoff: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "vibedoc_memory_history",
    description:
      "Earlier versions of MEMORY.md (a copy is saved before every write). No id → list (newest first); id → that version's content; id + restore: true → write it back (the current file is saved first, so a restore is undoable).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Version id from the list, e.g. 20261003T154209123Z-ai" },
        restore: { type: "boolean", description: "With id: restore that version" },
      },
      required: [],
    },
  },
  {
    name: "vibedoc_save_entry",
    description:
      "Save one long-lived fact (convention, gotcha, decision, preference) as its own entry. Omit id to create; pass id to update. Put facts that should outlast this session here, not in the handoff.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Entry id to update, e.g. E001. Omit to create." },
        type: { type: "string", enum: [...ENTRY_TYPES] },
        summary: { type: "string", description: "One line, at most 120 characters" },
        body: { type: "string", description: "Details and the why (markdown)" },
      },
      required: ["type", "summary"],
    },
  },
  {
    name: "vibedoc_import_memory",
    description:
      "Import the developer's Claude Code memory for this project into knowledge entries. Without apply it only previews; call again with apply: true to write.",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string", enum: [...MEMORY_SOURCES] },
        apply: { type: "boolean", description: "Write the previewed entries. Default false (preview only)." },
      },
      required: ["source"],
    },
  },
  {
    name: "vibedoc_export_memory",
    description:
      "Write the knowledge entries into a managed block in AGENTS.md (created if missing) and CLAUDE.md (if it exists), so Cursor, Codex and other agents see the same conventions. Text outside the block is never touched.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "vibedoc_recall",
    description:
      "Search memory entries by topic or keyword. Returns a compact list (id, type, summary); fetch bodies with vibedoc_get_entries.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Topic or keywords, e.g. \"sse events\"" },
        type: { type: "string", enum: [...ENTRY_TYPES] },
        limit: { type: "number", description: "Max results, default 10" },
      },
      required: ["query"],
    },
  },
  {
    name: "vibedoc_get_entries",
    description: "Fetch full knowledge entries (body included) by id, after vibedoc_recall or the session-start index. Max 20 ids per call.",
    inputSchema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "string" }, description: 'e.g. ["E012", "E030"]' } },
      required: ["ids"],
    },
  },
  {
    name: "vibedoc_delete_entry",
    description: "Delete a knowledge entry that is wrong or no longer true. Git keeps its history.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "e.g. E001" } },
      required: ["id"],
    },
  },
  {
    name: "vibedoc_create_doc",
    description:
      "Create a new doc from a template. Use vibedoc_list_templates to see available IDs. Fails if file exists.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        templateId: { type: "string", description: 'Defaults to "blank"' },
      },
      required: ["path"],
    },
  },
  {
    name: "vibedoc_list_templates",
    description: "List all doc templates with IDs, names, and default paths.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "vibedoc_get_context",
    description:
      "Bundle multiple docs into a single context block. Useful for loading several docs at once before starting a task.",
    inputSchema: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "Array of relative doc paths to bundle",
        },
      },
      required: ["paths"],
    },
  },
  {
    name: "vibedoc_propose_edit",
    description:
      "Propose targeted edits to a doc for the user to review. Does NOT write the file: the user sees a diff in the UI and accepts or rejects it. Each edit replaces one exact old_string (must match exactly once, include enough surrounding text to be unique) with new_string; edits apply in order. Only send the parts that change. For a brand-new doc, use a single edit with an empty old_string.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path to the doc file" },
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              old_string: { type: "string", description: "Exact text currently in the doc" },
              new_string: { type: "string", description: "Replacement text" },
            },
            required: ["old_string", "new_string"],
          },
        },
        summary: { type: "string", description: "One short line describing the change" },
      },
      required: ["path", "edits"],
    },
  },
  {
    name: "vibedoc_propose_plan",
    description:
      "Propose a plan for the user to review: kind \"breakdown\" (tasks: pass epic for an existing epic, newEpic to create the epic with the tasks, or neither for loose tasks with no epic) or kind \"roadmap\" (new horizons and epics: horizons + epics; an epic's parent is an existing horizon id or a horizon key in this plan; epic body = one outcome sentence, a blank line, then **In scope:** / **Out of scope:** / **Done when:**). Does NOT write anything: the user sees the plan in the UI, can uncheck items, and accepts. Validated against the current files; on errors, fix the plan and call again. Each task body is the full markdown below the meta block (## Goal, ## Context, ## Scope, ## Files, ## Acceptance criteria, ## Verify). dependsOn lists keys of earlier tasks in this plan or existing task ids (\"T030\"). covers lists the epic's scenario ids (## Scenarios → ### S1: …) the task makes true.",
    inputSchema: {
      type: "object",
      properties: {
        plan: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["breakdown", "roadmap"] },
            epic: { type: "string", description: "breakdown: existing epic id, e.g. R004 (not a horizon). Omit with newEpic or for loose tasks" },
            newEpic: {
              type: "object",
              description: "breakdown from a spec: create this epic and link the tasks to it (not together with epic)",
              properties: {
                title: { type: "string" },
                parent: { type: "string", description: "Existing horizon id, e.g. R002" },
                body: { type: "string", description: "One outcome sentence, a blank line, then **In scope:** / **Out of scope:** / **Done when:**" },
              },
              required: ["title", "parent", "body"],
            },
            horizons: {
              type: "array",
              description: "roadmap: new horizons (no parent)",
              items: {
                type: "object",
                properties: { key: { type: "string", description: "e.g. h1" }, title: { type: "string" }, body: { type: "string" } },
                required: ["key", "title"],
              },
            },
            epics: {
              type: "array",
              description: "roadmap: new epics",
              items: {
                type: "object",
                properties: {
                  key: { type: "string", description: "e.g. e1" },
                  title: { type: "string" },
                  parent: { type: "string", description: "Existing horizon id (R002) or a horizon key in this plan (h1)" },
                  body: { type: "string" },
                },
                required: ["key", "title", "parent", "body"],
              },
            },
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string", description: "Stable key within the plan, e.g. t1" },
                  title: { type: "string" },
                  size: { type: "string", description: "S (~1 hr) | M (2–3 hrs) | L (half day)" },
                  dependsOn: { type: "array", items: { type: "string" } },
                  covers: { type: "array", items: { type: "string" }, description: "Scenario ids of the epic's ## Scenarios this task covers (\"S1\"); each becomes a step of the task's Manual tests. When the epic has scenarios, cover every one." },
                  due: { type: "string", description: "YYYY-MM-DD" },
                  body: { type: "string", description: "Markdown below the meta block" },
                },
                required: ["key", "title", "body"],
              },
            },
          },
          required: ["kind"],
        },
      },
      required: ["plan"],
    },
  },
  {
    name: "vibedoc_ask_questions",
    description:
      "Ask the user 1–4 multiple-choice questions, shown as a card in the chat UI (same shape as AskUserQuestion). The tool can't wait for answers: after calling it, end your turn. The answers arrive as the next user message, one line per question keyed by its header, e.g. `- Scope: Label A, Label B` or `- Scope: Other: \"free text\"`.",
    inputSchema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              question: { type: "string", description: "The full question" },
              header: { type: "string", description: "Short label (max ~12 chars), used as the answer key" },
              multiSelect: { type: "boolean", description: "true = checkboxes, false = one choice" },
              options: {
                type: "array",
                minItems: 2,
                maxItems: 4,
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["label"],
                },
              },
            },
            required: ["question", "header", "multiSelect", "options"],
          },
        },
      },
      required: ["questions"],
    },
  },
  {
    name: "vibedoc_get_planning_guide",
    description:
      "Load the instructions for planning work from chat. Call this first when the user asks to plan or generate a roadmap (kind \"roadmap\") or to break an epic into tasks (kind \"breakdown\"), then follow it.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["roadmap", "breakdown"] },
      },
      required: ["kind"],
    },
  },
  {
    name: "vibedoc_append_doc",
    description:
      "Append content to an existing doc file. Adds two newlines before the appended content.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path to the doc file" },
        content: { type: "string", description: "Content to append" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "vibedoc_rename_doc",
    description: "Rename or move a doc file to a new path.",
    inputSchema: {
      type: "object",
      properties: {
        oldPath: { type: "string", description: "Current path of the doc" },
        newPath: { type: "string", description: "New path for the doc" },
      },
      required: ["oldPath", "newPath"],
    },
  },
  {
    name: "vibedoc_delete_doc",
    description: "Delete a doc file. This action cannot be undone.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path of the doc to delete" },
      },
      required: ["path"],
    },
  },
  {
    name: "vibedoc_get_file_map",
    description:
      "Get a structured map of all documentation files with descriptions and last-modified dates. Use at session start to orient yourself without reading each file individually.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "vibedoc_read_registry",
    description:
      "Read docs/REGISTRY.md — file tree + annotations so you know which doc to open for any task. Call at session start after vibedoc_read_memory. If absent, call vibedoc_rebuild_registry first.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "vibedoc_rebuild_registry",
    description:
      "Regenerate docs/REGISTRY.md — refreshes the file tree, adds stub rows for new files, and preserves existing descriptions/keywords. Run after adding or removing docs.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "vibedoc_annotate_doc",
    description:
      "Add or update the description and keywords for one doc in the registry without a full rebuild.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: 'Relative path of the doc, e.g. "docs/api-reference.md"',
        },
        description: {
          type: "string",
          description: "Short description of what this doc contains",
        },
        keywords: {
          type: "string",
          description: "Comma-separated keywords for this doc",
        },
      },
      required: ["path", "description", "keywords"],
    },
  },
  {
    name: "vibedoc_get_roadmap",
    description:
      "Get the product roadmap: horizons (spine nodes, e.g. v2.0) with their nested feature items, statuses and linked tasks.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "vibedoc_create_roadmap_item",
    description:
      "Create a roadmap item (plans/roadmap/R*.md). Omit parent to create a horizon on the spine; set parent to a horizon id (e.g. R001) to create a feature under it.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        parent: { type: "string", description: "Horizon id, e.g. R001. Omit for a horizon." },
        status: { type: "string", enum: ["planned", "in-progress", "paused", "done"] },
        order: { type: "number", description: "Sort key (steps of 10). Defaults to last among siblings." },
        tasks: { type: "array", items: { type: "string" }, description: 'Linked task ids, e.g. ["T001"]' },
        due: { type: "string", description: "Due date YYYY-MM-DD (optional)" },
        body: { type: "string", description: "Markdown description" },
      },
      required: ["title"],
    },
  },
  {
    name: "vibedoc_update_roadmap_item",
    description:
      "Update fields of a roadmap item. Only the given fields change. parent: null (or \"\") makes it a horizon.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "e.g. R004" },
        title: { type: "string" },
        parent: { type: ["string", "null"] },
        status: { type: "string", enum: ["planned", "in-progress", "paused", "done"] },
        order: { type: "number" },
        tasks: { type: "array", items: { type: "string" } },
        due: { type: ["string", "null"], description: "Due date YYYY-MM-DD; null clears it" },
        priority: { type: ["string", "null"], enum: [...PRIORITIES, null], description: "P0 (highest) … P3; null clears it" },
        specs: { type: ["array", "null"], items: { type: "string" }, description: "Capability spec slugs this epic changes (docs/specs/<slug>.md); its tasks get their requirements. [] or null removes the line" },
        body: { type: "string" },
      },
      required: ["id"],
    },
  },
];
