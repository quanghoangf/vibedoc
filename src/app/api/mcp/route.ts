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

import { NextRequest, NextResponse } from 'next/server'
import {
  getConfiguredRoot, listDocs, readDoc, searchDocs, writeDoc,
  getProjectSummary, listTasks, getTask, updateTaskStatus,
  logDecision, readMemory, updateMemory, logSessionStart,
  TaskStatus,
} from '@/lib/core'
import { emitUpdate } from '@/lib/events'
import { z } from 'zod'

// Simple hand-rolled MCP handler (avoids stdio transport issues in Next.js)
// Implements the JSON-RPC 2.0 MCP protocol directly.

type JsonRpcRequest = {
  jsonrpc: '2.0'
  id: string | number | null
  method: string
  params?: Record<string, unknown>
}

function ok(id: JsonRpcRequest['id'], result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}

function err(id: JsonRpcRequest['id'], code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } })
}

const TOOLS = [
  {
    name: 'vibedoc_get_status',
    description: 'Get project status overview: active tasks, blockers, doc count, memory. Call this at session start.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'vibedoc_read_doc',
    description: 'Read a doc file by name. Use: "CLAUDE", "HLD", "EVENT_CATALOG", "MEMORY", "user-service/API", "ADR-001".',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Doc name, e.g. "CLAUDE", "HLD", "user-service/API"' } }, required: ['query'] },
  },
  {
    name: 'vibedoc_list_docs',
    description: 'List all documentation files grouped by section. Use to discover what docs exist.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'vibedoc_search_docs',
    description: 'Full-text search across all docs. Returns files and line snippets.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search term' } }, required: ['query'] },
  },
  {
    name: 'vibedoc_write_doc',
    description: 'Write or create a documentation file. Use to add new docs or update existing ones. Path is relative to project root (e.g., "docs/api/endpoints.md"). Creates parent directories as needed. Triggers real-time browser update so the user can review.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path from project root, e.g. "docs/api/my-guide.md"' },
        content: { type: 'string', description: 'Full markdown content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'vibedoc_list_tasks',
    description: 'List all tasks as a kanban board. Filter by status optionally.',
    inputSchema: { type: 'object', properties: { status: { type: 'string', enum: ['all', 'todo', 'in-progress', 'blocked', 'done', 'cancelled'] } }, required: [] },
  },
  {
    name: 'vibedoc_get_task',
    description: 'Read a specific task file including scope, criteria, and definition of done.',
    inputSchema: { type: 'object', properties: { taskId: { type: 'string', description: 'e.g. "T001", "T003"' } }, required: ['taskId'] },
  },
  {
    name: 'vibedoc_update_task',
    description: 'Update task status. Call when starting, finishing, or blocking a task. UI updates in real time.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'in-progress', 'done', 'blocked', 'cancelled'] },
      },
      required: ['taskId', 'status'],
    },
  },
  {
    name: 'vibedoc_log_decision',
    description: 'Write a new Architecture Decision Record (ADR) when making a technical decision.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        context: { type: 'string' },
        decision: { type: 'string' },
        rationale: { type: 'string' },
        alternatives: { type: 'array', items: { type: 'object', properties: { option: { type: 'string' }, reason: { type: 'string' } } } },
        consequences: { type: 'string' },
      },
      required: ['title', 'context', 'decision'],
    },
  },
  {
    name: 'vibedoc_read_memory',
    description: 'Read MEMORY.md — the session handoff file. Always call this at session start.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'vibedoc_update_memory',
    description: 'Update MEMORY.md with session summary. Call at END of every session.',
    inputSchema: {
      type: 'object',
      properties: {
        currentState: { type: 'string' },
        justCompleted: { type: 'array', items: { type: 'string' } },
        workingOn: { type: 'string' },
        upNext: { type: 'array', items: { type: 'string' } },
        issues: { type: 'array', items: { type: 'string' } },
        decisions: { type: 'array', items: { type: 'string' } },
        techDebt: { type: 'array', items: { type: 'string' } },
        handoff: { type: 'string' },
      },
      required: ['currentState', 'handoff'],
    },
  },
]

async function handleTool(name: string, args: Record<string, unknown>) {
  const root = getConfiguredRoot()

  switch (name) {
    case 'vibedoc_get_status': {
      const s = await getProjectSummary(root)
      const b = s.tasks.board
      const lines = [
        `## ${s.name} — Project Status`,
        `**Docs:** ${s.docs.total} files`,
        `**Memory:** ${s.memory.exists ? 'exists' : 'not yet created'}`,
        '',
        '### Board',
        `📋 Todo: ${b.todo}  🔨 In Progress: ${b['in-progress']}  🚫 Blocked: ${b.blocked}  ✅ Done: ${b.done}`,
      ]
      if (s.tasks.active.length > 0) {
        lines.push('', '**Active:**')
        s.tasks.active.forEach(t => lines.push(`  🔨 ${t.id}: ${t.title}`))
      }
      if (s.tasks.blocked.length > 0) {
        lines.push('', '**Blocked:**')
        s.tasks.blocked.forEach(t => lines.push(`  🚫 ${t.id}: ${t.title}`))
      }
      return lines.join('\n')
    }

    case 'vibedoc_read_doc': {
      const { path: docPath, content } = await readDoc(String(args.query), root)
      emitUpdate('doc_read', { path: docPath })
      return `## ${docPath}\n\n${content}`
    }

    case 'vibedoc_list_docs': {
      const docs = await listDocs(root)
      const sections: Record<string, string[]> = {}
      for (const d of docs) {
        if (!sections[d.section]) sections[d.section] = []
        sections[d.section].push(d.path)
      }
      const lines = [`📚 ${docs.length} files\n`]
      for (const [s, files] of Object.entries(sections)) {
        lines.push(`**${s}** (${files.length})`)
        files.forEach(f => lines.push(`  ${f}`))
        lines.push('')
      }
      return lines.join('\n')
    }

    case 'vibedoc_search_docs': {
      const results = await searchDocs(String(args.query), root)
      if (!results.length) return `No results for "${args.query}"`
      const lines = [`🔍 "${args.query}" — ${results.length} file(s)\n`]
      for (const r of results) {
        lines.push(`**${r.file}** (${r.totalHits} hits)`)
        r.hits.forEach(h => lines.push(`  L${h.line}: ${h.text}`))
        lines.push('')
      }
      return lines.join('\n')
    }

    case 'vibedoc_write_doc': {
      const docPath = String(args.path)
      const content = String(args.content)
      await writeDoc(docPath, content, root)
      emitUpdate('doc_updated', { path: docPath })
      return `✅ Written: ${docPath}`
    }

    case 'vibedoc_list_tasks': {
      const { board, tasks } = await listTasks(root)
      const filter = (args.status as string) || 'all'
      const cols = filter === 'all' ? ['in-progress', 'blocked', 'todo', 'done', 'cancelled'] : [filter]
      const lines = [`## Tasks (${tasks.length})\n`]
      for (const col of cols) {
        const items = board[col as TaskStatus] || []
        lines.push(`### ${col.toUpperCase()} (${items.length})`)
        if (!items.length) lines.push('  (empty)')
        items.forEach(t => lines.push(`  **${t.id}** ${t.title}${t.size ? ` — ${t.size}` : ''}`))
        lines.push('')
      }
      return lines.join('\n')
    }

    case 'vibedoc_get_task': {
      const task = await getTask(String(args.taskId), root)
      return `## ${task.file}\n\n${task.raw}`
    }

    case 'vibedoc_update_task': {
      const result = await updateTaskStatus(String(args.taskId), args.status as TaskStatus, root, 'ai')
      emitUpdate('task_updated', { taskId: args.taskId, status: args.status, previousStatus: result.previousStatus, task: result.task })
      return `✅ **${result.task.id}** → **${result.task.status}**\n(was: ${result.previousStatus})`
    }

    case 'vibedoc_log_decision': {
      const result = await logDecision(args as unknown as Parameters<typeof logDecision>[0], root, 'ai')
      emitUpdate('decision_logged', result)
      return `📝 **${result.adrNumber}** logged\nFile: ${result.path}`
    }

    case 'vibedoc_read_memory': {
      await logSessionStart(root, 'ai')
      emitUpdate('session_start', { root })
      const memory = await readMemory(root)
      return memory.content
    }

    case 'vibedoc_update_memory': {
      await updateMemory(args as unknown as Parameters<typeof updateMemory>[0], root, 'ai')
      emitUpdate('memory_updated', { root })
      return `🧠 MEMORY.md updated`
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

export async function POST(req: NextRequest) {
  let body: JsonRpcRequest
  try {
    body = await req.json()
  } catch {
    return err(null, -32700, 'Parse error')
  }

  const { id, method, params } = body

  // MCP initialize
  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'vibedoc', version: '1.0.0' },
    })
  }

  // tools/list
  if (method === 'tools/list') {
    return ok(id, { tools: TOOLS })
  }

  // tools/call
  if (method === 'tools/call') {
    const name = (params?.name as string) || ''
    const args = (params?.arguments as Record<string, unknown>) || {}
    try {
      const text = await handleTool(name, args)
      return ok(id, { content: [{ type: 'text', text }] })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return ok(id, { content: [{ type: 'text', text: `❌ ${msg}` }], isError: true })
    }
  }

  return err(id, -32601, `Method not found: ${method}`)
}

// GET for connection test / SSE upgrade (some clients use GET)
export async function GET() {
  return NextResponse.json({ name: 'vibedoc', version: '1.0.0', status: 'ready', tools: TOOLS.map(t => t.name) })
}
