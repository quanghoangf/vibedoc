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
import {
  getConfiguredRoot,
  listDocs,
  readDoc,
  searchDocs,
  writeDoc,
  createDoc,
  getContext,
  getProjectSummary,
  listTasks,
  getTask,
  updateTaskStatus,
  saveManualTests,
  claimNextTask,
  logDecision,
  updateMemory,
  saveEntry,
  deleteEntry,
  sessionStartMemory,
  recallEntries,
  relatedEntries,
  getEntriesByIds,
  noteDocEdit,
  readProjectSettings,
  logSessionStart,
  readActivity,
  findBacklinks,
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
import { TEMPLATES } from "@/lib/templates";
import { emitUpdate } from "@/lib/events";
import { groupSessions, sessionDuration, sessionsForTask } from "@/lib/sessions";
import { dueState, localToday, roadmapHealth, type TaskInfo } from "@/lib/roadmap-health";
import { latestReview } from "@/lib/review";

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
const withGap = (block: string) => (block ? `\n\n${block}` : "");

const TOOLS = [
  {
    name: "vibedoc_get_status",
    description:
      "Get project status overview: active tasks, blockers, doc count, memory. Call this at session start.",
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
    name: "vibedoc_read_doc",
    description:
      'Read a doc file by name. Use: "CLAUDE", "HLD", "EVENT_CATALOG", "MEMORY", "user-service/API", "ADR-001".',
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
      "List all documentation files grouped by section. Use to discover what docs exist.",
    inputSchema: { type: "object", properties: {}, required: [] },
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
    name: "vibedoc_update_task",
    description:
      "Update task status. Call when starting, finishing, or blocking a task. UI updates in real time. " +
      "When moving a task to done, include manualTests: a checklist of what a human should click through to trust it, " +
      "written from what you actually changed (optional, never blocks the move).",
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
            "Plain lines become unticked steps.",
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
      "Read MEMORY.md — the session handoff file. Always call this at session start.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "vibedoc_update_memory",
    description:
      "Update MEMORY.md with session summary. Call at END of every session. Durable facts (conventions, gotchas, decisions, preferences) go to vibedoc_save_entry, not the handoff.",
    inputSchema: {
      type: "object",
      properties: {
        currentState: { type: "string" },
        justCompleted: { type: "array", items: { type: "string" } },
        workingOn: { type: "string" },
        upNext: { type: "array", items: { type: "string" } },
        issues: { type: "array", items: { type: "string" } },
        decisions: { type: "array", items: { type: "string" } },
        techDebt: { type: "array", items: { type: "string" } },
        handoff: { type: "string" },
      },
      required: ["currentState", "handoff"],
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
      const s = await getProjectSummary(root);
      const b = s.tasks.board;
      const lines = [
        `## ${s.name} — Project Status`,
        `**Docs:** ${s.docs.total} files`,
        `**Memory:** ${s.memory.exists ? "exists" : "not yet created"}`,
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

    case "vibedoc_read_doc": {
      const { path: docPath, content } = await readDoc(
        String(args.query),
        root,
      );
      emitUpdate("doc_read", { path: docPath });
      const backlinks = await findBacklinks(docPath, root);
      let result = `## ${docPath}\n\n${content}`;
      if (backlinks.length > 0) {
        result += "\n\n---\n\n## Referenced by\n";
        backlinks.forEach((b) => {
          result += `- ${b.file} (line ${b.line}): ${b.text}\n`;
        });
      }
      return result;
    }

    case "vibedoc_list_docs": {
      const docs = await listDocs(root);
      const sections: Record<string, string[]> = {};
      for (const d of docs) {
        if (!sections[d.section]) sections[d.section] = [];
        sections[d.section].push(d.path);
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
      return `## ${task.file}\n\n${task.raw}` + withGap(await relatedEntries(task, root));
    }

    case "vibedoc_update_task": {
      const report = typeof args.manualTests === "string" && args.manualTests.trim() ? args.manualTests : null;
      if (report) await saveManualTests(String(args.taskId), report, root, "ai");
      const result = await updateTaskStatus(
        String(args.taskId),
        args.status as TaskStatus,
        root,
        "ai",
        { actor: "ai", agent },
      );
      emitUpdate("task_updated", {
        taskId: args.taskId,
        status: args.status,
        previousStatus: result.previousStatus,
        task: result.task,
      });
      const tests = result.task.manualTests;
      return `✅ **${result.task.id}** → **${result.task.status}**\n(was: ${result.previousStatus})` +
        (tests ? `\n🧪 Manual tests: ${tests.done}/${tests.total} ticked` : "") +
        (await roadmapHint(root, result.task.id));
    }

    case "vibedoc_next_task": {
      const epicId = String(args.epic ?? "").trim();
      if (!epicId) throw new Error("epic is required");
      const { result, task, previousStatus } = await claimNextTask(epicId, root, agent);
      if (result.kind === "finished") {
        const { items } = await listRoadmap(root);
        const statuses = await taskInfoMap(root);
        const epic = items.find((i) => i.id === epicId.toUpperCase());
        const id = epic?.id ?? epicId.toUpperCase();
        const n = epic ? epic.tasks.filter((t) => t in statuses).length : 0;
        const nudge = roadmapHealth(items, statuses, localToday()).drift
          .find((d) => d.id === id && d.suggestedStatus === "done");
        return `✅ Epic ${id} is finished — all ${n} tasks done or cancelled. Stop here.` +
          (nudge ? `\n\n🗺️ ${nudge.message} → vibedoc_update_roadmap_item { "id": "${id}", "status": "done" }` : "");
      }
      if (result.kind === "waiting") {
        return `⏳ Nothing ready in ${epicId.toUpperCase()}.\n` + result.waiting.map((w) => `- ${w.reason}`).join("\n") +
          (result.needsHuman ? "\n\nNeeds a human: approve, send back or unblock one of the tasks above." : "");
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
        ? `\n\n⚠️ Changes requested (${review.at}):\n${review.note}\nAddress this first; the rest of the spec below still applies.`
        : "";
      return `🔨 Claimed **${task.id}** ${task.title} (now in-progress)${changes}\n\n## ${task.file}\n\n${task.raw}` +
        (await roadmapHint(root, task.id)) + withGap(await relatedEntries(task, root));
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
      await logSessionStart(root, "ai");
      emitUpdate("session_start", { root });
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

    case "vibedoc_save_entry": {
      const entry = await saveEntry(args as unknown as EntryInput, root, "ai");
      emitUpdate("memory_updated", { root, entryId: entry.id });
      return `🧠 Saved **${entry.id}** · ${entry.type} · ${entry.summary}\n${entry.file}`;
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
      const { found, missing } = await getEntriesByIds(ids, root);
      const blocks = found.map((e) => `## ${e.id} · ${e.type} · ${e.summary}\nupdated ${e.updatedAt}${e.body ? `\n\n${e.body}` : ""}`);
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
      await createDoc(docPath, template.content, root);
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
      await renameDoc(oldPath, newPath, root);
      emitUpdate("doc_renamed", { oldPath, newPath });
      return `✅ Renamed: ${oldPath} → ${newPath}`;
    }

    case "vibedoc_delete_doc": {
      const docPath = String(args.path);
      await deleteDoc(docPath, root);
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
  if (!custom.length) return TOOLS;
  return TOOLS.map((t) => {
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
    const root = req.nextUrl.searchParams.get("root") || getConfiguredRoot();
    return ok(id, { tools: withProjectStatuses((await readProjectSettings(root)).statuses) });
  }

  // tools/call
  if (method === "tools/call") {
    const name = (params?.name as string) || "";
    const args = (params?.arguments as Record<string, unknown>) || {};
    try {
      const root = req.nextUrl.searchParams.get("root") || getConfiguredRoot();
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
    tools: TOOLS.map((t) => t.name),
  });
}
