/**
 * /api/mcp
 *
 * MCP server over HTTP (Streamable HTTP transport).
 * AI agents (Claude Code, Cursor, Windsurf) connect here.
 *
 * Config in Claude Code:
 * {
 *   "mcpServers": {
 *     "vibedoc": {
 *       "url": "http://localhost:3000/api/mcp"
 *     }
 *   }
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { ENTRY_TYPES, type EntryInput } from "@/lib/entries";
import { formatCompactLine, tokenize } from "@/lib/recall";
import { findRequirement, formatRequirement, formatSpecList } from "@/lib/specs";
import { SEVERITIES, validateFindings } from "@/lib/verification";
import { formatEntryLinks } from "@/lib/memory-graph";
import { docLinks, formatRelatedFiles } from "@/lib/doc-links";
import { failedRunNote } from "@/lib/work-queue";
import {
  rootFrom,
  listDocs,
  readDoc,
  searchDocs,
  writeDoc,
  createDoc,
  getContext,
  getProjectSummary,
  detectFrontend,
  frontendAuthStatus,
  detectPlaywright,
  listTasks,
  getTask,
  updateTaskStatus,
  saveManualTests,
  claimNextTask,
  logDecision,
  updateMemory,
  listMemoryVersions,
  getMemoryVersion,
  restoreMemoryVersion,
  saveEntry,
  importClaudeMemory,
  exportEntries,
  deleteEntry,
  sessionStartMemory,
  backfillEpisodes,
  currentSessionId,
  writeRunEpisode,
  getEvidence,
  ensureFixtureKit,
  recordRunResult,
  recallEntries,
  relatedEntries,
  relatedSpecs,
  listSpecs,
  readSpec,
  getSpecContext,
  saveVerification,
  getVerifyContext,
  getEntriesByIds,
  markEntriesRecalled,
  getMemoryGraph,
  noteDocEdit,
  setDocProperties,
  readProjectSettings,
  logSessionStart,
  readActivity,
  getDocGraph,
  appendDoc,
  renameDoc,
  deleteDoc,
  listExplorerFiles,
  readRegistry,
  rebuildRegistry,
  updateRegistryAnnotation,
  editDoc,
  listRoadmap,
  createRoadmapItem,
  updateRoadmapItem,
  readPlanningSkill,
  TaskStatus,
  type PlanningKind,
  type CreateRoadmapItemParams,
  type UpdateRoadmapItemPatch,
} from "@/lib/core";
import type { TextEdit } from "@/lib/diff";
import { agentFromUserAgent } from "@/lib/owner";
import type { StatusDef } from "@/lib/statuses";
import { planTarget, validatePlan, type Plan } from "@/lib/plan";
import { isDemo } from "@/lib/demo";
import { formatFrontend, frontendNotes, frontendStatusLine } from "@/lib/frontend";
import path from "path";
import { TEMPLATES } from "@/lib/templates";
import { emitUpdate } from "@/lib/events";
import { groupSessions, sessionDuration, sessionsForTask } from "@/lib/sessions";
import { dueState, localToday, roadmapHealth, type TaskInfo } from "@/lib/roadmap-health";
import { autoFixLine, latestReview } from "@/lib/review";
import { PRIORITIES, type Priority } from "@/lib/doc-priority";

// Simple hand-rolled MCP handler (avoids stdio transport issues in Next.js)
// Implements the JSON-RPC 2.0 MCP protocol directly.

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

function ok(id: JsonRpcRequest["id"], result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function err(id: JsonRpcRequest["id"], code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } });
}

const MAX_ENTRY_IDS = 20;

/** Demo mode (R042) runs only these. An allowlist, so a new write tool is refused until it is added here. */
const DEMO_TOOLS = new Set([
  "vibedoc_get_status", "vibedoc_get_sessions", "vibedoc_read_doc", "vibedoc_list_docs", "vibedoc_search_docs",
  "vibedoc_list_tasks", "vibedoc_get_task", "vibedoc_read_memory", "vibedoc_memory_history", "vibedoc_recall",
  "vibedoc_get_entries", "vibedoc_list_templates", "vibedoc_get_context", "vibedoc_get_planning_guide",
  "vibedoc_get_file_map", "vibedoc_read_registry", "vibedoc_get_roadmap", "vibedoc_get_frontend", "vibedoc_get_evidence",
]);

/** False for a write in demo mode. `vibedoc_memory_history` reads, except with `restore: true`. */
function allowedInDemo(name: string, args: Record<string, unknown>): boolean {
  return DEMO_TOOLS.has(name) && !(name === "vibedoc_memory_history" && args.restore === true);
}

const visibleTools = () => (isDemo() ? TOOLS.filter((t) => DEMO_TOOLS.has(t.name)) : TOOLS);
const MEMORY_SOURCES = ["claude-code"] as const; // R052: Cursor / Cline importers are out of scope
const withGap = (block: string) => (block ? `\n\n${block}` : "");

const TOOLS = [
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
    name: "vibedoc_read_doc",
    description:
      'Read a doc file by name. Use: "CLAUDE", "HLD", "EVENT_CATALOG", "MEMORY", "user-service/API", "ADR-001". Ends with a "## Related files" footer when the doc has links: what it links to, what links to it (docs by path; tasks, epics, entries, ADRs by id) broken links ([x](y.md) / [[y]] to no file) and stale paths (backticked paths to missing files), so you know what to read next.',
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
      "Propose a plan for the user to review: kind \"breakdown\" (tasks: pass epic for an existing epic, newEpic to create the epic with the tasks, or neither for loose tasks with no epic) or kind \"roadmap\" (new horizons and epics: horizons + epics; an epic's parent is an existing horizon id or a horizon key in this plan; epic body = one outcome sentence, a blank line, then **In scope:** / **Out of scope:** / **Done when:**). Does NOT write anything: the user sees the plan in the UI, can uncheck items, and accepts. Validated against the current files; on errors, fix the plan and call again. Each task body is the full markdown below the meta block (## Goal, ## Context, ## Scope, ## Files, ## Acceptance criteria, ## Verify). dependsOn lists keys of earlier tasks in this plan or existing task ids (\"T030\").",
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

/** Maps the terminal skill's tools to the chat tools. The skill text follows it. */
const PLANNING_PREAMBLE = `You are running this planning skill inside the VibeDoc chat, not a terminal:
- Where it says AskUserQuestion, call vibedoc_ask_questions with the same shape, then END YOUR TURN; answers arrive as the next message ("Answers: - <header>: <labels>").
- Where it says to show the draft and ask Create/Adjust, call vibedoc_propose_plan instead (do not ask a Create/Adjust question); the user previews, unchecks and accepts in the UI, and Accept writes everything. Skip the skill's write steps: never call vibedoc_create_roadmap_item, vibedoc_update_roadmap_item or any other write tool, and never write files yourself.
- Read the project with vibedoc_* tools (vibedoc_get_roadmap, vibedoc_list_tasks, vibedoc_read_doc, vibedoc_search_docs, vibedoc_get_file_map); you have no shell or file access.
- Skip steps that need a shell or the codebase beyond what those tools return; say so briefly. Tasks written this way know less about the code than a terminal run would; tell the user that once.

---

`;

async function taskInfoMap(root: string): Promise<Record<string, TaskInfo>> {
  const { tasks } = await listTasks(root);
  return Object.fromEntries(tasks.map((t) => [t.id, { status: t.status, due: t.due }]));
}

/** After a task move, point the agent at roadmap items linking it that are now out of sync. */
async function roadmapHint(root: string, taskId: string): Promise<string> {
  const { items } = await listRoadmap(root);
  const linked = new Set(items.filter((i) => i.tasks.includes(taskId)).map((i) => i.id));
  if (!linked.size) return "";
  const { drift } = roadmapHealth(items, await taskInfoMap(root), localToday());
  const hits = drift.filter((d) => d.suggestedStatus && linked.has(d.id));
  if (!hits.length) return "";
  return "\n\n🗺️ Roadmap out of sync:\n" + hits
    .map((d) => `- ${d.message} → vibedoc_update_roadmap_item { "id": "${d.id}", "status": "${d.suggestedStatus}" }`)
    .join("\n");
}

/** `agent` is who is calling (args.agent, else the MCP client from its User-Agent); starting a task makes it the owner. */
async function handleTool(name: string, args: Record<string, unknown>, root: string, agent = "agent") {

  switch (name) {
    case "vibedoc_get_status": {
      const [s, frontend] = await Promise.all([getProjectSummary(root), detectFrontend(root)]);
      const b = s.tasks.board;
      const lines = [
        `## ${s.name} — Project Status`,
        `**Docs:** ${s.docs.total} files`,
        `**Memory:** ${s.memory.exists ? "exists" : "not yet created"}`,
        frontendStatusLine(frontend),
        "",
        "### Board",
        `📋 Todo: ${b.todo}  🔨 In Progress: ${b["in-progress"]}  👀 Review: ${b.review ?? 0}  🚫 Blocked: ${b.blocked}  ✅ Done: ${b.done}`,
      ];
      if (s.tasks.active.length > 0) {
        lines.push("", "**Active:**");
        s.tasks.active.forEach((t) => lines.push(`  🔨 ${t.id}: ${t.title}`));
      }
      if (s.tasks.blocked.length > 0) {
        lines.push("", "**Blocked:**");
        s.tasks.blocked.forEach((t) => lines.push(`  🚫 ${t.id}: ${t.title}`));
      }
      lines.push("", "_See vibedoc_get_sessions for what happened recently._");
      return lines.join("\n");
    }

    case "vibedoc_get_frontend": {
      const app = await detectFrontend(root);
      const notes = app ? frontendNotes(app, Number(process.env.PORT) || 3000, path.resolve(root) === process.cwd()) : [];
      const [playwright, auth] = await Promise.all([app ? detectPlaywright(root, app) : null, frontendAuthStatus(root)]);
      // R061: specs record screenshots / video / evidence through the fixture kit, written on demand (not in demo)
      const kit = app && playwright?.installed && !isDemo() ? await ensureFixtureKit(root, app) : null;
      return formatFrontend(app, notes, playwright, auth) +
        (kit ? `\n**Test kit:** \`${kit.dir}\` — specs in its parent folder import \`{ test, expect } from '${kit.importPath}'\` and use \`step()\`` : "");
    }

    case "vibedoc_get_sessions": {
      const limit = Number(args.limit) || 10;
      const since = args.since ? String(args.since) : null;
      let sessions = groupSessions(await readActivity(root, 2000));
      if (args.taskId) sessions = sessionsForTask(sessions, String(args.taskId));
      if (since) {
        const t = Date.parse(since);
        if (Number.isNaN(t)) return `Invalid "since": ${since} (expected an ISO timestamp)`;
        sessions = sessions.filter((x) => Date.parse(x.end) >= t);
      }
      sessions = sessions.slice(0, limit);
      if (!sessions.length) return "No sessions" + (args.taskId ? ` touched ${args.taskId}` : "") + (since ? ` since ${since}` : "") + ".";
      return sessions.map((x) => [
        `### ${x.actor === "ai" ? "🤖 Agent" : "👤 Human"} · ${x.start} (${sessionDuration(x)})`,
        x.headline,
        ...x.tasks.map((t) => `- ${t.id} → ${t.lastStatus}`),
        ...x.docs.map((d) => `- 📄 ${d}`),
        ...x.decisions.map((d) => `- 📝 ${d}`),
      ].join("\n")).join("\n\n");
    }

    case "vibedoc_list_specs":
      return formatSpecList(await listSpecs(root));

    case "vibedoc_get_spec": {
      const found = await readSpec(String(args.capability ?? ""), root);
      if (!found) {
        const known = (await listSpecs(root)).map((sp) => sp.capability);
        throw new Error(`No spec "${String(args.capability ?? "")}". Known: ${known.join(", ") || "none (docs/specs/<capability>.md)"}`);
      }
      if (!args.requirement) return `## ${found.path}\n\n${found.raw}`;
      const req = findRequirement(found.spec, String(args.requirement));
      if (!req) throw new Error(`No requirement "${String(args.requirement)}" in ${found.path}. Requirements: ${found.spec.requirements.map((r) => r.name).join(", ") || "none"}`);
      return `## ${found.path} · ${found.spec.title}\n\n${formatRequirement(req)}`;
    }

    case "vibedoc_spec_context":
      return getSpecContext(String(args.capability ?? ""), root, {
        epics: Array.isArray(args.epics) ? args.epics.map(String) : undefined,
        query: typeof args.query === "string" ? args.query : undefined,
      });

    case "vibedoc_read_doc": {
      const { path: docPath, content } = await readDoc(
        String(args.query),
        root,
      );
      emitUpdate("doc_read", { path: docPath });
      const related = formatRelatedFiles(docLinks(await getDocGraph(root), docPath));
      return `## ${docPath}\n\n${content}` + (related ? `\n\n---\n\n${related}` : "");
    }

    case "vibedoc_list_docs": {
      const docs = await listDocs(root);
      const sections: Record<string, string[]> = {};
      for (const d of docs) {
        if (!sections[d.section]) sections[d.section] = [];
        sections[d.section].push(d.priority ? `${d.path} [${d.priority}]` : d.path);
      }
      const lines = [`📚 ${docs.length} files\n`];
      for (const [s, files] of Object.entries(sections)) {
        lines.push(`**${s}** (${files.length})`);
        files.forEach((f) => lines.push(`  ${f}`));
        lines.push("");
      }
      return lines.join("\n");
    }

    case "vibedoc_search_docs": {
      const results = await searchDocs(String(args.query), root);
      if (!results.length) return `No results for "${args.query}"`;
      const lines = [`🔍 "${args.query}" — ${results.length} file(s)\n`];
      for (const r of results) {
        lines.push(`**${r.file}** (${r.totalHits} hits)`);
        r.hits.forEach((h) => lines.push(`  L${h.line}: ${h.text}`));
        lines.push("");
      }
      return lines.join("\n");
    }

    case "vibedoc_write_doc": {
      const docPath = String(args.path);
      const content = String(args.content);
      await writeDoc(docPath, content, root);
      await noteDocEdit(root, docPath, "ai");
      emitUpdate("doc_updated", { path: docPath, actor: "ai" });
      return `✅ Written: ${docPath}`;
    }

    case "vibedoc_set_doc_priority": {
      const docPath = String(args.path);
      const priority = args.priority ?? null;
      if (priority !== null && !PRIORITIES.includes(priority as Priority)) {
        return `❌ priority must be one of ${PRIORITIES.join(", ")} or null`;
      }
      await setDocProperties(docPath, { priority: priority as Priority | null }, root);
      await noteDocEdit(root, docPath, "ai");
      emitUpdate("doc_updated", { path: docPath, actor: "ai", properties: { priority } });
      return priority ? `✅ ${docPath} is now ${priority}` : `✅ Cleared the priority of ${docPath}`;
    }

    case "vibedoc_list_tasks": {
      const { board, tasks } = await listTasks(root);
      const filter = (args.status as string) || "all";
      const cols =
        filter === "all"
          ? ["in-progress", "review", "blocked", "paused", "todo", "done", "cancelled"]
          : [filter];
      const lines = [`## Tasks (${tasks.length})\n`];
      for (const col of cols) {
        const items = board[col as TaskStatus] || [];
        lines.push(`### ${col.toUpperCase()} (${items.length})`);
        if (!items.length) lines.push("  (empty)");
        items.forEach((t) =>
          lines.push(`  **${t.id}** ${t.title}${t.size ? ` — ${t.size}` : ""}`),
        );
        lines.push("");
      }
      return lines.join("\n");
    }

    case "vibedoc_get_task": {
      const task = await getTask(String(args.taskId), root);
      return `## ${task.file}\n\n${task.raw}` + withGap(await relatedEntries(task, root)) + withGap(await relatedSpecs(task, root));
    }

    case "vibedoc_get_evidence": {
      const runId = typeof args.runId === "string" && args.runId ? args.runId : null;
      const evidence = await getEvidence(String(args.taskId), root, { runId });
      if (!evidence) throw new Error(`No kept run ${runId} for ${args.taskId}`);
      return evidence.markdown;
    }

    case "vibedoc_verify_context":
      return getVerifyContext(String(args.taskId ?? ""), root);

    case "vibedoc_report_findings": {
      const findings = validateFindings(args.findings);
      if (typeof findings === "string") throw new Error(findings);
      const sha = typeof args.sha === "string" && /^[0-9a-f]{4,40}$/i.test(args.sha.trim()) ? args.sha.trim().toLowerCase() : undefined;
      const task = await saveVerification(String(args.taskId ?? ""), findings, root, `ai:${agent}`, sha);
      emitUpdate("task_updated", { taskId: task.id, status: task.status, task });
      const counts = SEVERITIES.map((sev) => [sev, findings.filter((f) => f.severity === sev).length] as const).filter(([, n]) => n);
      return `🔎 **${task.id}** verification saved: ` + (counts.length ? counts.map(([sev, n]) => `${n} ${sev}`).join(", ") : "nothing found");
    }

    case "vibedoc_update_task": {
      const report = typeof args.manualTests === "string" && args.manualTests.trim() ? args.manualTests : null;
      const spec = typeof args.spec === "string" && args.spec.trim() ? args.spec.trim() : undefined;
      if (args.autoResult !== undefined && args.autoResult !== "passed" && args.autoResult !== "failed")
        throw new Error('autoResult must be "passed" or "failed"');
      const autoRun = args.autoResult ? { result: args.autoResult as "passed" | "failed", date: new Date().toISOString().slice(0, 10) } : undefined;
      if (report || spec || autoRun) await saveManualTests(String(args.taskId), report, root, "ai", { spec, autoRun });
      // R063: a pass is judged with the newest recorded run: unverified steps are unticked and counted in the header
      const honesty = autoRun?.result === "passed" ? await recordRunResult(String(args.taskId), "passed", null, root) : null;
      // An agent's "done" with checks a human still has to click through (manual items, 🤖 ones no passing run
      // proved) lands in review instead, so a person looks before it counts as done
      const left = args.status === "done" ? (await getTask(String(args.taskId), root)).manualTests?.untested ?? 0 : 0;
      const status = (left > 0 ? "review" : args.status) as TaskStatus;
      const result = await updateTaskStatus(
        String(args.taskId),
        status,
        root,
        "ai",
        { actor: "ai", agent },
      );
      emitUpdate("task_updated", {
        taskId: args.taskId,
        status,
        previousStatus: result.previousStatus,
        task: result.task,
      });
      const tests = result.task.manualTests;
      return `✅ **${result.task.id}** → **${result.task.status}**\n(was: ${result.previousStatus})` +
        (left > 0 ? `\n👀 Moved to review, not done: ${left} ${left === 1 ? "check needs" : "checks need"} a human. Carry on with the next task; a person approves it.` : "") +
        (tests ? `\n🧪 Manual tests: ${tests.done}/${tests.total} ticked` +
          (tests.auto ? ` · 🤖 ${tests.auto} automated` : "") +
          (tests.spec ? ` · spec \`${tests.spec}\`` : "") +
          (tests.autoRun ? ` · last run ${tests.autoRun.result} ${tests.autoRun.date}` : "") : "") +
        (honesty?.unverified.length
          ? `\n⚠️ ${honesty.unverified.length} ${honesty.unverified.length === 1 ? "step" : "steps"} unverified (no assertion on the page, or passes without the app): ${honesty.unverified.map((n) => `"${n}"`).join(", ")}. Fix those steps in the spec (a real expect on the page), run it again, then report again.`
          : "") +
        (await roadmapHint(root, result.task.id));
    }

    case "vibedoc_next_task": {
      const epicId = String(args.epic ?? "").trim();
      if (!epicId) throw new Error("epic is required");
      const { result, task, previousStatus } = await claimNextTask(epicId, root, agent);
      // R050: nothing ready = the run is over; leave an episode unless the session wrote a handoff
      const runEnd = async () => {
        const ep = await writeRunEpisode(root, `epic ${epicId.toUpperCase()}`, agent);
        if (!ep) return "";
        emitUpdate("episode_saved", ep);
        return `\n\nEpisode saved → ${ep.file}`;
      };
      if (result.kind === "finished") {
        const { items } = await listRoadmap(root);
        const statuses = await taskInfoMap(root);
        const epic = items.find((i) => i.id === epicId.toUpperCase());
        const id = epic?.id ?? epicId.toUpperCase();
        const n = epic ? epic.tasks.filter((t) => t in statuses).length : 0;
        const nudge = roadmapHealth(items, statuses, localToday()).drift
          .find((d) => d.id === id && d.suggestedStatus === "done");
        return `✅ Epic ${id} is finished — all ${n} tasks done or cancelled. Stop here.` +
          (nudge ? `\n\n🗺️ ${nudge.message} → vibedoc_update_roadmap_item { "id": "${id}", "status": "done" }` : "") +
          (await runEnd());
      }
      if (result.kind === "waiting") {
        return `⏳ Nothing ready in ${epicId.toUpperCase()}.\n` + result.waiting.map((w) => `- ${w.reason}`).join("\n") +
          (result.needsHuman ? "\n\nNeeds a human: approve, send back or unblock one of the tasks above." : "") +
          (await runEnd());
      }
      if (!task) throw new Error(`claim of ${epicId.toUpperCase()} returned no task`);
      emitUpdate("task_updated", {
        taskId: task.id,
        status: task.status,
        previousStatus,
        task,
      });
      // Sent back from review (R043): the reviewer's note comes first, before the spec
      const review = latestReview(task.raw ?? "");
      const changes = review?.outcome === "changes requested"
        ? `\n\n⚠️ Changes requested (${review.at}):\n${review.note}\n` +
          (review.auto && task.raw ? `${autoFixLine(task.raw, (await readProjectSettings(root)).maxAutoFixes)}\n` : "") +
          "Address this first; the rest of the spec below still applies."
        : "";
      const failed = failedRunNote(task.manualTests);
      return `🔨 Claimed **${task.id}** ${task.title} (now in-progress)${changes}${failed ? `\n\n${failed}` : ""}\n\n## ${task.file}\n\n${task.raw}` +
        (await roadmapHint(root, task.id)) + withGap(await relatedEntries(task, root)) + withGap(await relatedSpecs(task, root));
    }

    case "vibedoc_log_decision": {
      const result = await logDecision(
        args as unknown as Parameters<typeof logDecision>[0],
        root,
        "ai",
      );
      emitUpdate("decision_logged", result);
      return `📝 **${result.adrNumber}** logged\nFile: ${result.path}`;
    }

    case "vibedoc_read_memory": {
      // read before logSessionStart, which opens a new session: the one still running is the agent's, never backfill it
      const running = currentSessionId(root);
      await logSessionStart(root, "ai");
      emitUpdate("session_start", { root });
      // R050: ended sessions with no handoff get an `inferred` episode first, so the response below can show it
      for (const ep of await backfillEpisodes(root, { excludeSessionId: running })) {
        emitUpdate("episode_saved", ep);
      }
      return sessionStartMemory(root);
    }

    case "vibedoc_update_memory": {
      await updateMemory(
        args as unknown as Parameters<typeof updateMemory>[0],
        root,
        "ai",
      );
      emitUpdate("memory_updated", { root });
      return `🧠 MEMORY.md updated`;
    }

    case "vibedoc_memory_history": {
      const vid = typeof args.id === "string" ? args.id.trim() : "";
      if (!vid) {
        const versions = (await listMemoryVersions(root)).slice(0, 20);
        if (!versions.length) return "No saved versions of MEMORY.md yet.";
        return versions.map((v) => `${v.id} · ${v.at} · ${v.actor} · ${v.reason} · ${v.excerpt}`).join("\n");
      }
      // a malformed id throws in core; to the agent it is just as missing
      const content = await getMemoryVersion(vid, root).catch(() => null);
      if (content === null) return `Version ${vid} not found`;
      if (args.restore !== true) return content;
      const { restoredFrom, newId } = await restoreMemoryVersion(vid, root, "ai");
      emitUpdate("memory_updated", { root });
      return `Restored MEMORY.md to ${restoredFrom}; the replaced version is ${newId ?? "(none — there was no MEMORY.md)"}`;
    }

    case "vibedoc_save_entry": {
      // only the declared fields: agents never set **Source:** by hand (R052)
      const { id, type, summary, body } = args as unknown as EntryInput;
      const entry = await saveEntry({ id, type, summary, body }, root, "ai", agent);
      emitUpdate("memory_updated", { root, entryId: entry.id });
      return `🧠 Saved **${entry.id}** · ${entry.type} · ${entry.summary}\n${entry.file}`;
    }

    case "vibedoc_import_memory": {
      if (!(MEMORY_SOURCES as readonly unknown[]).includes(args.source)) {
        throw new Error(`Unknown source "${String(args.source ?? "")}": use one of ${MEMORY_SOURCES.join(", ")}`);
      }
      const apply = args.apply === true;
      const { dir, found, plan, written } = await importClaudeMemory(root, "ai", apply, agent);
      if (!found && !plan.onlyInVibedoc.length) return `No Claude Code memory found at ${dir}`;
      if (written) emitUpdate("memory_updated", { root });
      const pad = (s: string, n: number) => s.padEnd(n);
      const rows = [
        `📥 Claude Code memory → ${found} found in ${dir}`,
        ...plan.create.map((c) => `+ ${pad(apply ? "created" : "new", 10)} ${pad(c.type, 11)} ${c.summary}   (${c.name})`),
        ...plan.update.map((u) => `~ ${pad(apply ? "updated" : "update", 10)} ${pad(u.entry.id, 11)} ${u.candidate.type}  ${u.candidate.summary}`),
        `= ${pad("unchanged", 10)} ${plan.unchanged.length}`,
        ...plan.onlyInVibedoc.map((e) => `? ${pad("only in VibeDoc", 10)} ${e.id}  ${e.summary}   (${e.source}, not deleted)`),
      ];
      const counts = `${plan.create.length} new · ${plan.update.length} update · ${plan.unchanged.length} unchanged`;
      if (!apply) rows.push(counts, plan.create.length + plan.update.length ? "Call again with apply: true to write." : "Nothing to write.");
      else rows.push(written ? `Wrote ${written} ${written === 1 ? "entry" : "entries"} (${plan.create.length} created · ${plan.update.length} updated).` : "Nothing to write.");
      return rows.join("\n");
    }

    case "vibedoc_export_memory": {
      const { count, files } = await exportEntries(root, "ai");
      // whole-file shape (no edits): an open editor re-reads the file and splices in the difference
      for (const f of files) if (f.changed) emitUpdate("doc_updated", { path: f.file, actor: "ai" });
      return `📤 Exported ${count} ${count === 1 ? "entry" : "entries"} → ${files.map((f) => `${f.file} (${f.changed ? "updated" : "unchanged"})`).join(", ")}`;
    }

    case "vibedoc_recall": {
      const query = String(args.query ?? "");
      if (!tokenize(query).length) {
        return `No searchable words in "${query}". Use topic words, e.g. vibedoc_recall { "query": "sse events" }.`;
      }
      const limit = Number(args.limit) > 0 ? Math.floor(Number(args.limit)) : undefined;
      const hits = await recallEntries(query, { type: args.type ? String(args.type) : undefined, limit }, root);
      if (!hits.length) return `No entries match "${query}".`;
      return `${hits.length} ${hits.length === 1 ? "match" : "matches"} for "${query}"\n` +
        hits.map(formatCompactLine).join("\n") +
        `\nFetch full entries with vibedoc_get_entries { ids: [...] }`;
    }

    case "vibedoc_get_entries": {
      const ids = Array.isArray(args.ids) ? args.ids.map(String) : [];
      if (!ids.length) throw new Error('ids must be a non-empty array, e.g. { "ids": ["E001"] }');
      if (ids.length > MAX_ENTRY_IDS) throw new Error(`Too many ids (${ids.length}); fetch at most ${MAX_ENTRY_IDS} per call and split the rest`);
      const [{ found, missing }, graph] = await Promise.all([getEntriesByIds(ids, root), getMemoryGraph(root)]);
      // R051: a full-body fetch is what counts as "recalled" (not recall lists or the session index)
      if (await markEntriesRecalled(found.map((e) => e.id), root)) emitUpdate("memory_updated", { root });
      const blocks = found.map((e) => {
        const links = formatEntryLinks(graph, e.id);
        return `## ${e.id} · ${e.type} · ${e.summary}\nupdated ${e.updatedAt}${e.source ? `\nSource: ${e.source}` : ""}${e.body ? `\n\n${e.body}` : ""}` +
          (links.length ? `\n\n${links.join("\n")}` : "");
      });
      if (missing.length) blocks.push(`Not found: ${missing.join(", ")}`);
      return blocks.join("\n\n");
    }

    case "vibedoc_delete_entry": {
      const entry = await deleteEntry(String(args.id ?? ""), root, "ai");
      emitUpdate("memory_updated", { root, entryId: entry.id });
      return `🗑️ Deleted **${entry.id}** · ${entry.summary}`;
    }

    case "vibedoc_create_doc": {
      const docPath = String(args.path);
      const templateId = args.templateId ? String(args.templateId) : "blank";
      const template =
        TEMPLATES.find((t) => t.id === templateId) ??
        TEMPLATES.find((t) => t.id === "blank")!;
      await createDoc(docPath, template.content, root, "ai");
      emitUpdate("doc_created", { path: docPath });
      return `✅ Created: ${docPath} (template: ${template.name})`;
    }

    case "vibedoc_list_templates": {
      return TEMPLATES.map(
        (t) =>
          `**${t.id}** — ${t.name}\n  ${t.description}\n  Default: \`${t.defaultPath}\``,
      ).join("\n\n");
    }

    case "vibedoc_get_context": {
      const paths = args.paths as string[];
      const context = await getContext(paths, root);
      if (!context) return "(no content — check paths are correct)";
      return context;
    }

    case "vibedoc_propose_edit": {
      const docPath = String(args.path);
      const edits = Array.isArray(args.edits) ? (args.edits as TextEdit[]) : [];
      if (edits.length === 0) throw new Error("edits must be a non-empty array");
      // Validate now so the agent can fix a bad old_string before the user ever sees it
      await editDoc(docPath, edits, root, true);
      return `📝 Proposed ${edits.length} edit(s) to ${docPath}. The user will accept or reject them in the UI; not applied yet.`;
    }

    case "vibedoc_propose_plan": {
      // Validate only, like propose_edit: the UI writes via POST /api/plan/apply after Accept.
      const [{ items }, { tasks }] = await Promise.all([listRoadmap(root), listTasks(root)]);
      const errors = validatePlan(args.plan, { roadmap: items, taskIds: tasks.map((t) => t.id) });
      if (errors.length > 0) throw new Error(`Invalid plan:\n- ${errors.join("\n- ")}`);
      const plan = args.plan as Plan;
      if (plan.kind === "roadmap") {
        return `📋 Proposed ${(plan.horizons ?? []).length} horizons and ${(plan.epics ?? []).length} epics. The user reviews and accepts in the UI; nothing is written yet.`;
      }
      return `📋 Proposed ${plan.tasks.length} tasks for ${planTarget(plan)}. The user reviews and accepts in the UI; nothing is written yet.`;
    }

    case "vibedoc_ask_questions": {
      // Records nothing: the UI renders the tool input as a card and sends the answers as the next message.
      const qs = args.questions;
      const errors: string[] = [];
      if (!Array.isArray(qs) || qs.length < 1 || qs.length > 4) {
        errors.push(`questions must be an array of 1–4 items (got ${Array.isArray(qs) ? qs.length : typeof qs})`);
      } else {
        qs.forEach((q: Record<string, unknown>, i: number) => {
          const at = `questions[${i}]`;
          if (!q || typeof q !== "object") return errors.push(`${at} must be an object`);
          if (typeof q.question !== "string" || !q.question.trim()) errors.push(`${at}.question must be a non-empty string`);
          if (typeof q.header !== "string" || !q.header.trim()) errors.push(`${at}.header must be a non-empty string`);
          if (typeof q.multiSelect !== "boolean") errors.push(`${at}.multiSelect must be a boolean`);
          const opts = q.options;
          if (!Array.isArray(opts) || opts.length < 2 || opts.length > 4) {
            errors.push(`${at}.options must have 2–4 items (got ${Array.isArray(opts) ? opts.length : typeof opts})`);
          } else {
            opts.forEach((o: Record<string, unknown>, j: number) => {
              if (!o || typeof o.label !== "string" || !o.label.trim()) errors.push(`${at}.options[${j}].label must be a non-empty string`);
              if (o && o.description !== undefined && typeof o.description !== "string") errors.push(`${at}.options[${j}].description must be a string`);
            });
          }
        });
      }
      if (errors.length > 0) throw new Error(`Invalid questions:\n- ${errors.join("\n- ")}`);
      return `❓ Shown ${(qs as unknown[]).length} question(s) to the user. End your turn now; their answers arrive in the next message.`;
    }

    case "vibedoc_get_planning_guide":
      return PLANNING_PREAMBLE + (await readPlanningSkill(String(args.kind) as PlanningKind));

    case "vibedoc_append_doc": {
      const docPath = String(args.path);
      const content = String(args.content);
      await appendDoc(docPath, content, root);
      await noteDocEdit(root, docPath, "ai");
      emitUpdate("doc_updated", { path: docPath, actor: "ai" });
      return `✅ Appended to: ${docPath}`;
    }

    case "vibedoc_rename_doc": {
      const oldPath = String(args.oldPath);
      const newPath = String(args.newPath);
      await renameDoc(oldPath, newPath, root, "ai");
      emitUpdate("doc_renamed", { oldPath, newPath });
      return `✅ Renamed: ${oldPath} → ${newPath}`;
    }

    case "vibedoc_delete_doc": {
      const docPath = String(args.path);
      await deleteDoc(docPath, root, "ai");
      emitUpdate("doc_deleted", { path: docPath });
      return `✅ Deleted: ${docPath}`;
    }

    case "vibedoc_get_file_map": {
      const files = await listExplorerFiles(root);
      return JSON.stringify(files, null, 2);
    }

    case "vibedoc_read_registry": {
      const { content, exists } = await readRegistry(root);
      if (!exists)
        return `*(No REGISTRY.md found — call vibedoc_rebuild_registry to generate it)*`;
      return content;
    }

    case "vibedoc_rebuild_registry": {
      const result = await rebuildRegistry(root, "ai");
      emitUpdate("registry_rebuilt", {
        path: result.path,
        totalFiles: result.totalFiles,
      });
      return `✅ Registry rebuilt: ${result.path}\n${result.totalFiles} files indexed`;
    }

    case "vibedoc_annotate_doc": {
      const docPath = String(args.path);
      const description = String(args.description);
      const keywords = String(args.keywords);
      await updateRegistryAnnotation(docPath, description, keywords, root);
      emitUpdate("registry_rebuilt", { path: "docs/REGISTRY.md" });
      return `✅ Annotation updated for: ${docPath}`;
    }

    case "vibedoc_get_roadmap": {
      const { items } = await listRoadmap(root);
      if (items.length === 0) return "No roadmap items yet (plans/roadmap/ is empty).";
      const today = localToday();
      const { progress, drift } = roadmapHealth(items, await taskInfoMap(root), today);
      const icon = { done: "✓", "in-progress": "◐", paused: "⏸", planned: "○" } as const;
      const atRisk = new Set(drift.filter((d) => d.kind === "at-risk").map((d) => d.id));
      const fmt = (i: (typeof items)[number]) =>
        `${icon[i.status]} **${i.id}** ${i.title} — ${i.status}` +
        (i.tasks.length ? ` (tasks: ${i.tasks.join(", ")})` : "") +
        (progress[i.id] ? ` [${progress[i.id].done}/${progress[i.id].total} done]` : "") +
        (i.due ? ` due ${i.due}${dueState(i.due, i.status, today) === "overdue" ? " ⚠ overdue" : ""}` : "") +
        (atRisk.has(i.id) ? " ⚠ at risk" : "");
      const horizons = items.filter((i) => i.parent === null);
      const lines = ["## Roadmap"];
      for (const h of horizons) {
        lines.push("", `### ${fmt(h)}`);
        for (const c of items.filter((i) => i.parent === h.id)) lines.push(`- ${fmt(c)}`);
      }
      const orphans = items.filter((i) => i.parent !== null && !horizons.some((h) => h.id === i.parent));
      if (orphans.length) {
        lines.push("", "### Orphans (parent missing)");
        for (const o of orphans) lines.push(`- ${fmt(o)} (parent: ${o.parent})`);
      }
      if (drift.length) {
        lines.push("", "### ⚠️ Needs attention");
        for (const d of drift) lines.push(`- ${d.message}${d.suggestedStatus ? ` → suggest status "${d.suggestedStatus}"` : ""}`);
      }
      return lines.join("\n");
    }

    case "vibedoc_create_roadmap_item": {
      const item = await createRoadmapItem(args as unknown as CreateRoadmapItemParams, root, "ai");
      emitUpdate("roadmap_updated", { kind: "create", id: item.id });
      return `✅ Created **${item.id}** ${item.title}\nFile: ${item.file}`;
    }

    case "vibedoc_update_roadmap_item": {
      const { id, ...patch } = args;
      const item = await updateRoadmapItem(String(id ?? ""), patch as UpdateRoadmapItemPatch, root, "ai");
      emitUpdate("roadmap_updated", { kind: "update", id: item.id });
      return `✅ Updated **${item.id}** ${item.title} — ${item.status}${item.parent ? ` (parent: ${item.parent})` : " (horizon)"}`;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function withProjectStatuses(statuses: StatusDef[]) {
  const custom = statuses.filter((d) => d.id !== d.category);
  if (!custom.length) return visibleTools();
  return visibleTools().map((t) => {
    if (t.name !== "vibedoc_update_task") return t;
    return {
      ...t,
      description: t.description + " This project also has its own statuses: " +
        custom.map((d) => `"${d.id}" (${d.label}, works like ${d.category})`).join(", ") + ".",
      inputSchema: {
        ...t.inputSchema,
        properties: { ...t.inputSchema.properties, status: { type: "string", enum: statuses.map((d) => d.id) } },
      },
    };
  });
}

export async function POST(req: NextRequest) {
  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return err(null, -32700, "Parse error");
  }

  const { id, method, params } = body;

  // MCP initialize
  if (method === "initialize") {
    return ok(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "vibedoc", version: "1.0.0" },
    });
  }

  // tools/list: vibedoc_update_task's status enum follows the project's statuses (R055)
  if (method === "tools/list") {
    const root = rootFrom(req.nextUrl.searchParams.get("root"));
    return ok(id, { tools: withProjectStatuses((await readProjectSettings(root)).statuses) });
  }

  // tools/call
  if (method === "tools/call") {
    const name = (params?.name as string) || "";
    const args = (params?.arguments as Record<string, unknown>) || {};
    if (isDemo() && !allowedInDemo(name, args)) return err(id, -32000, "read-only demo");
    try {
      const root = rootFrom(req.nextUrl.searchParams.get("root"));
      const agent = typeof args.agent === "string" && args.agent.trim() ? args.agent.trim() : agentFromUserAgent(req.headers.get("user-agent"));
      const text = await handleTool(name, args, root, agent);
      return ok(id, { content: [{ type: "text", text }] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return ok(id, {
        content: [{ type: "text", text: `❌ ${msg}` }],
        isError: true,
      });
    }
  }

  return err(id, -32601, `Method not found: ${method}`);
}

// GET for connection test / SSE upgrade (some clients use GET)
export async function GET() {
  return NextResponse.json({
    name: "vibedoc",
    version: "1.0.0",
    status: "ready",
    tools: visibleTools().map((t) => t.name),
  });
}
