"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Task, TaskBoard, ActivityEvent, DocFile } from "@/lib/core";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Project {
  id: string;
  name: string;
  root: string;
}
interface Summary {
  name: string;
  root: string;
  tasks: {
    total: number;
    board: Record<string, number>;
    active: Task[];
    blocked: Task[];
  };
  docs: { total: number };
  memory: { content: string; exists: boolean };
  activity: ActivityEvent[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  todo: "text-muted border-border2",
  "in-progress": "text-amber border-amber/30 bg-amber/5",
  blocked: "text-danger border-danger/30 bg-danger/5",
  done: "text-teal border-teal/30 bg-teal/5",
  cancelled: "text-muted border-border line-through",
};
const STATUS_ICONS: Record<string, string> = {
  todo: "📋",
  "in-progress": "🔨",
  blocked: "🚫",
  done: "✅",
  cancelled: "❌",
};
const ACTIVITY_ICONS: Record<string, string> = {
  task_updated: "🔨",
  decision_logged: "📝",
  memory_updated: "🧠",
  doc_read: "📄",
  session_start: "🤖",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(ts: string) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState<
    "board" | "docs" | "activity" | "memory"
  >("board");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<string>("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [board, setBoard] = useState<TaskBoard | null>(null);
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<{
    path: string;
    content: string;
  } | null>(null);
  const [docSearch, setDocSearch] = useState("");
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveIndicator, setLiveIndicator] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  const rootParam = activeProject
    ? `?root=${encodeURIComponent(activeProject)}`
    : "";

  const refresh = useCallback(
    async (root?: string) => {
      const r = root || activeProject;
      if (!r) return;
      const rp = `?root=${encodeURIComponent(r)}`;
      try {
        const [sumRes, boardRes, docsRes, actRes] = await Promise.all([
          fetch(`/api/summary${rp}`).then((r) => r.json()),
          fetch(`/api/tasks${rp}`).then((r) => r.json()),
          fetch(`/api/docs${rp}`).then((r) => r.json()),
          fetch(`/api/activity${rp}&limit=30`).then((r) => r.json()),
        ]);
        setSummary(sumRes);
        setBoard(boardRes.board);
        setDocs(Array.isArray(docsRes) ? docsRes : []);
        setActivity(Array.isArray(actRes) ? actRes : []);
      } catch {}
      setLoading(false);
    },
    [activeProject],
  );

  // Load projects on mount
  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((p: Project[]) => {
        setProjects(p);
        if (p.length > 0) {
          setActiveProject(p[0].root);
          refresh(p[0].root);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  // SSE for real-time updates
  useEffect(() => {
    if (!activeProject) return;
    const es = new EventSource("/api/events");
    sseRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "connected") return;
        // Flash the live indicator
        setLiveIndicator(true);
        setTimeout(() => setLiveIndicator(false), 2000);
        // Refresh relevant data
        if (
          [
            "task_updated",
            "decision_logged",
            "memory_updated",
            "session_start",
          ].includes(msg.type)
        ) {
          refresh();
        }
      } catch {}
    };

    return () => {
      es.close();
    };
  }, [activeProject, refresh]);

  async function moveTask(taskId: string, status: string) {
    await fetch(`/api/tasks${rootParam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, status, actor: "human" }),
    });
    refresh();
  }

  async function openDoc(docPath: string) {
    const res = await fetch(
      `/api/docs${rootParam}&read=${encodeURIComponent(docPath)}`,
    );
    const data = await res.json();
    setSelectedDoc(data);
    setActiveTab("docs");
  }

  async function searchDocsFn(q: string) {
    if (!q.trim()) {
      setDocs([]);
      refresh();
      return;
    }
    const res = await fetch(`/api/docs${rootParam}&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    // Show search results in doc list
    setDocs(
      data.results?.map((r: { file: string }) => ({
        path: r.file,
        section: "search",
        name: r.file,
      })) || [],
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="flex gap-1.5 justify-center mb-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-accent animate-pulse-dot"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-muted text-sm font-mono">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top bar ── */}
      <header className="h-12 border-b border-border flex items-center px-4 gap-4 flex-shrink-0 bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
        {/* Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent to-teal flex items-center justify-center text-xs">
            ⬡
          </div>
          <span className="font-mono text-xs text-muted tracking-widest uppercase">
            VibeDoc
          </span>
        </div>

        {/* Project switcher */}
        <div className="relative">
          <button
            onClick={() => setProjectPickerOpen(!projectPickerOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface2 border border-border text-sm hover:border-border2 transition-colors"
          >
            <span className="text-txt font-medium truncate max-w-[200px]">
              {summary?.name || "Select project"}
            </span>
            <span className="text-muted text-xs">▾</span>
          </button>
          {projectPickerOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-surface border border-border2 rounded-lg shadow-xl z-50 py-1 animate-fade-in">
              {projects.map((p) => (
                <button
                  key={p.root}
                  onClick={() => {
                    setActiveProject(p.root);
                    refresh(p.root);
                    setProjectPickerOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-surface2 transition-colors",
                    p.root === activeProject && "text-accent",
                  )}
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted truncate font-mono">
                    {p.root}
                  </div>
                </button>
              ))}
              {projects.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted">
                  No projects found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats pills */}
        {summary && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 rounded-full bg-surface2 border border-border text-amber">
              🔨 {summary.tasks.board["in-progress"] || 0}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-surface2 border border-border text-muted">
              📋 {summary.tasks.board.todo || 0}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-surface2 border border-border text-teal">
              ✅ {summary.tasks.board.done || 0}
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-muted">
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full transition-colors duration-500",
              liveIndicator ? "bg-teal shadow-[0_0_6px_#4fd8b4]" : "bg-border2",
            )}
          />
          <span>{liveIndicator ? "live update" : "connected"}</span>
        </div>

        {/* MCP endpoint hint */}
        <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-surface2 border border-border">
          <span className="text-xs font-mono text-muted">MCP</span>
          <code className="text-xs font-mono text-accent">
            localhost:3000/api/mcp
          </code>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <nav className="w-48 border-r border-border flex-shrink-0 flex flex-col py-3 gap-0.5 px-2">
          {[
            { id: "board", icon: "⬡", label: "Board" },
            { id: "docs", icon: "📚", label: "Docs" },
            { id: "activity", icon: "⚡", label: "Activity" },
            { id: "memory", icon: "🧠", label: "Memory" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left",
                activeTab === item.id
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-muted hover:text-txt hover:bg-surface2",
              )}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}

          {/* Board quick stats */}
          {board && (
            <div className="mt-auto pt-3 border-t border-border px-1">
              {[
                { status: "in-progress", label: "Active" },
                { status: "blocked", label: "Blocked" },
                { status: "todo", label: "Todo" },
                { status: "done", label: "Done" },
              ].map(({ status, label }) => {
                const count = board[status as keyof TaskBoard]?.length || 0;
                return (
                  <div
                    key={status}
                    className="flex justify-between items-center py-1 px-1 text-xs"
                  >
                    <span className="text-muted">
                      {STATUS_ICONS[status]} {label}
                    </span>
                    <span className="font-mono text-txt">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        {/* ── Panel ── */}
        <main className="flex-1 overflow-y-auto">
          {/* ══ BOARD ══ */}
          {activeTab === "board" && board && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-xl">Task Board</h1>
                <span className="text-xs font-mono text-muted">
                  {summary?.tasks.total || 0} tasks
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {(["in-progress", "todo", "blocked", "done"] as const).map(
                  (col) => (
                    <div key={col} className="flex flex-col gap-2">
                      {/* Column header */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{STATUS_ICONS[col]}</span>
                        <span className="text-xs font-mono font-semibold text-muted uppercase tracking-wider">
                          {col}
                        </span>
                        <span className="ml-auto text-xs font-mono text-muted">
                          {board[col].length}
                        </span>
                      </div>

                      {/* Task cards */}
                      <div className="flex flex-col gap-2 min-h-[60px]">
                        {board[col].map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onMove={moveTask}
                            onOpen={() => openDoc(task.file)}
                          />
                        ))}
                        {board[col].length === 0 && (
                          <div className="border border-dashed border-border rounded-lg py-6 text-center text-xs text-muted">
                            empty
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {/* ══ DOCS ══ */}
          {activeTab === "docs" && (
            <div
              className="flex h-full"
              style={{ minHeight: "calc(100vh - 3rem)" }}
            >
              {/* Doc list sidebar */}
              <div className="w-56 border-r border-border flex-shrink-0 flex flex-col">
                <div className="p-3 border-b border-border">
                  <input
                    className="w-full bg-surface2 border border-border rounded-md px-2.5 py-1.5 text-xs font-mono text-txt placeholder:text-muted outline-none focus:border-accent transition-colors"
                    placeholder="Search docs..."
                    value={docSearch}
                    onChange={(e) => {
                      setDocSearch(e.target.value);
                      searchDocsFn(e.target.value);
                    }}
                  />
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {groupDocsBySection(docs).map(([section, files]) => (
                    <div key={section}>
                      <div className="px-3 py-1.5 text-xs font-mono text-muted uppercase tracking-wider">
                        {section}
                      </div>
                      {files.map((doc) => (
                        <button
                          key={doc.path}
                          onClick={() => openDoc(doc.path)}
                          className={cn(
                            "w-full text-left px-3 py-1.5 text-xs hover:bg-surface2 transition-colors truncate",
                            selectedDoc?.path === doc.path
                              ? "text-accent bg-accent/5"
                              : "text-muted hover:text-txt",
                          )}
                        >
                          {doc.name}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Doc content */}
              <div className="flex-1 overflow-y-auto">
                {selectedDoc ? (
                  <div className="p-6 max-w-3xl">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                      <span className="text-xs font-mono text-muted">
                        {selectedDoc.path}
                      </span>
                    </div>
                    <div
                      className="prose-dark"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(selectedDoc.content),
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted text-sm">
                    Select a document to read
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ ACTIVITY ══ */}
          {activeTab === "activity" && (
            <div className="p-6 max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-xl">Activity Feed</h1>
                <div className="flex items-center gap-1.5 text-xs font-mono text-teal">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                  live
                </div>
              </div>

              {activity.length === 0 ? (
                <div className="text-center py-16 text-muted text-sm">
                  <p className="text-3xl mb-3">⚡</p>
                  <p>No activity yet.</p>
                  <p className="text-xs mt-1">
                    Connect an AI agent to see real-time updates here.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                  <div className="flex flex-col gap-0">
                    {activity.map((evt, i) => (
                      <div
                        key={evt.id}
                        className="flex gap-4 pb-4 animate-fade-in"
                      >
                        <div className="relative flex-shrink-0 w-8 h-8 rounded-full bg-surface2 border border-border flex items-center justify-center text-sm z-10">
                          {ACTIVITY_ICONS[evt.type] || "•"}
                        </div>
                        <div className="flex-1 pt-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-txt">
                              {evt.title}
                            </span>
                            {evt.actor === "ai" && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-mono">
                                AI
                              </span>
                            )}
                          </div>
                          {evt.detail && (
                            <p className="text-xs text-muted truncate">
                              {evt.detail}
                            </p>
                          )}
                          <p className="text-xs text-muted/60 mt-0.5 font-mono">
                            {timeAgo(evt.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ MEMORY ══ */}
          {activeTab === "memory" && (
            <div className="p-6 max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-display text-xl">Session Memory</h1>
                <span className="text-xs font-mono text-muted">
                  memory/MEMORY.md
                </span>
              </div>

              {summary?.memory.exists ? (
                <div className="bg-surface border border-border rounded-xl p-5">
                  <div
                    className="prose-dark"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(summary.memory.content),
                    }}
                  />
                </div>
              ) : (
                <div className="text-center py-16 border border-dashed border-border rounded-xl text-muted text-sm">
                  <p className="text-3xl mb-3">🧠</p>
                  <p>No MEMORY.md yet.</p>
                  <p className="text-xs mt-1">
                    AI will create one at the end of the first session.
                  </p>
                </div>
              )}

              <div className="mt-4 p-4 bg-surface2 border border-border rounded-xl">
                <p className="text-xs font-mono text-muted mb-2">
                  Add to your CLAUDE.md system prompt:
                </p>
                <pre className="text-xs font-mono text-accent/80 whitespace-pre-wrap leading-relaxed">{`At session start:
1. Call vibedoc_read_memory
2. Call vibedoc_get_status

At session end:
- Call vibedoc_update_memory with full handoff`}</pre>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── TaskCard component ───────────────────────────────────────────────────────
function TaskCard({
  task,
  onMove,
  onOpen,
}: {
  task: Task;
  onMove: (id: string, status: string) => void;
  onOpen: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const NEXT_STATUS: Record<string, string[]> = {
    todo: ["in-progress"],
    "in-progress": ["done", "blocked", "todo"],
    blocked: ["in-progress", "cancelled"],
    done: ["todo"],
    cancelled: ["todo"],
  };
  const nextStatuses = NEXT_STATUS[task.status] || [];

  return (
    <div
      className={cn(
        "group relative bg-surface border rounded-lg p-3 text-sm transition-all hover:border-border2",
        STATUS_COLORS[task.status] || "border-border",
      )}
    >
      {/* ID badge */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-mono text-muted">{task.id}</span>
        {task.size && <span className="text-xs text-muted">{task.size}</span>}
      </div>

      {/* Title */}
      <p className="font-medium text-txt text-sm leading-snug mb-2">
        {task.title}
      </p>

      {/* Phase */}
      {task.phase && <p className="text-xs text-muted mb-2">{task.phase}</p>}

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onOpen}
          className="text-xs px-2 py-0.5 rounded bg-surface2 border border-border text-muted hover:text-txt hover:border-border2 transition-colors"
        >
          open
        </button>
        {nextStatuses.map((s) => (
          <button
            key={s}
            onClick={() => onMove(task.id, s)}
            className="text-xs px-2 py-0.5 rounded bg-surface2 border border-border text-muted hover:text-txt hover:border-border2 transition-colors"
          >
            {STATUS_ICONS[s]} {s === "in-progress" ? "start" : s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function groupDocsBySection(docs: DocFile[]): [string, DocFile[]][] {
  const map: Record<string, DocFile[]> = {};
  for (const doc of docs) {
    if (!map[doc.section]) map[doc.section] = [];
    map[doc.section].push(doc);
  }
  return Object.entries(map);
}

function renderMarkdown(md: string): string {
  // Basic markdown to HTML — handles the common cases in our docs
  let html = md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^---$/gm, "<hr />")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Code blocks
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    if (match.includes("---")) return '<tr class="border-row"></tr>';
    const cells = match
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    return "<tr>" + cells.map((c) => `<td>${c}</td>`).join("") + "</tr>";
  });
  html = html.replace(/(<tr>[\s\S]*?<\/tr>)+/g, "<table>$&</table>");

  // Lists
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, "<ul>$&</ul>");
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

  // Paragraphs
  html = html
    .split("\n\n")
    .map((block) => {
      if (block.startsWith("<")) return block;
      return `<p>${block.replace(/\n/g, " ")}</p>`;
    })
    .join("\n");

  return html;
}
