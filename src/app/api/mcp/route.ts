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
  logDecision,
  readMemory,
  updateMemory,
  logSessionStart,
  findBacklinks,
  appendDoc,
  renameDoc,
  deleteDoc,
  listExplorerFiles,
  readRegistry,
  rebuildRegistry,
  updateRegistryAnnotation,
  TaskStatus,
} from "@/lib/core";
import { TEMPLATES } from "@/lib/templates";
import { emitUpdate } from "@/lib/events";
import { z } from "zod";

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

const TOOLS = [
  {
    name: "vibedoc_get_status",
    description:
      "Get project status overview: active tasks, blockers, doc count, memory. Call this at session start.",
    inputSchema: { type: "object", properties: {}, required: [] },
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
          enum: ["all", "todo", "in-progress", "blocked", "done", "cancelled"],
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
      "Update task status. Call when starting, finishing, or blocking a task. UI updates in real time.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string" },
        status: {
          type: "string",
          enum: ["todo", "in-progress", "done", "blocked", "cancelled"],
        },
      },
      required: ["taskId", "status"],
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
      "Update MEMORY.md with session summary. Call at END of every session.",
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
];

async function handleTool(name: string, args: Record<string, unknown>) {
  const root = getConfiguredRoot();

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
        `📋 Todo: ${b.todo}  🔨 In Progress: ${b["in-progress"]}  🚫 Blocked: ${b.blocked}  ✅ Done: ${b.done}`,
      ];
      if (s.tasks.active.length > 0) {
        lines.push("", "**Active:**");
        s.tasks.active.forEach((t) => lines.push(`  🔨 ${t.id}: ${t.title}`));
      }
      if (s.tasks.blocked.length > 0) {
        lines.push("", "**Blocked:**");
        s.tasks.blocked.forEach((t) => lines.push(`  🚫 ${t.id}: ${t.title}`));
      }
      return lines.join("\n");
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
      emitUpdate("doc_updated", { path: docPath });
      return `✅ Written: ${docPath}`;
    }

    case "vibedoc_list_tasks": {
      const { board, tasks } = await listTasks(root);
      const filter = (args.status as string) || "all";
      const cols =
        filter === "all"
          ? ["in-progress", "blocked", "todo", "done", "cancelled"]
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
      return `## ${task.file}\n\n${task.raw}`;
    }

    case "vibedoc_update_task": {
      const result = await updateTaskStatus(
        String(args.taskId),
        args.status as TaskStatus,
        root,
        "ai",
      );
      emitUpdate("task_updated", {
        taskId: args.taskId,
        status: args.status,
        previousStatus: result.previousStatus,
        task: result.task,
      });
      return `✅ **${result.task.id}** → **${result.task.status}**\n(was: ${result.previousStatus})`;
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
      const memory = await readMemory(root);
      return memory.content;
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

    case "vibedoc_append_doc": {
      const docPath = String(args.path);
      const content = String(args.content);
      await appendDoc(docPath, content, root);
      emitUpdate("doc_updated", { path: docPath });
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

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
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

  // tools/list
  if (method === "tools/list") {
    return ok(id, { tools: TOOLS });
  }

  // tools/call
  if (method === "tools/call") {
    const name = (params?.name as string) || "";
    const args = (params?.arguments as Record<string, unknown>) || {};
    try {
      const text = await handleTool(name, args);
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
