"use client"

import dynamic from "next/dynamic"
import { useMemo, useState, useSyncExternalStore } from "react"
import { ChevronRight } from "lucide-react"
import type { ExplorerFile } from "@/types"
import { useT } from "@/context/LanguageContext"
import { freshness, FreshnessLegend } from "./Freshness"

// ECharts uses browser APIs — must be dynamically imported with ssr: false
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false })

interface TreemapNode {
  name: string
  value: number
  /** a file tile: its path; a folder tile: undefined */
  path?: string
  /** a folder tile: its path and how many files it holds */
  folder?: string
  count?: number
  itemStyle?: { color: string }
}

interface FileTreemapProps {
  files: ExplorerFile[]
  onSelect: (path: string) => void
}

// The canvas can't read CSS vars, so the design tokens are read off the root as computed now (follows .dark and the
// accent setting) and re-read when either changes
const TOKENS = ["bg", "surface", "surface2", "border", "border2", "txt", "muted", "accent"] as const
type Token = (typeof TOKENS)[number]
type Paint = (k: Token, alpha?: number) => string

function subscribeTheme(cb: () => void) {
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-accent", "style"] })
  return () => mo.disconnect()
}
const readTokens = () => {
  const css = getComputedStyle(document.documentElement)
  return TOKENS.map((k) => css.getPropertyValue(`--rgb-${k}`).trim()).join("|")
}

function painter(snapshot: string): Paint {
  const rgb = new Map(TOKENS.map((k, i) => [k, (snapshot.split("|")[i] || "128 128 128").split(/\s+/).join(", ")]))
  return (k, alpha = 1) => `rgba(${rgb.get(k)}, ${alpha})`
}

/** Freshness as neutral ink over the surface (the legend's steps); never a status hue, never the accent. */
function freshnessColor(mtime: string, paint: Paint): string {
  const f = freshness(mtime)
  return f === 0 ? paint("txt", 0.3) : f === 1 ? paint("txt", 0.14) : paint("surface2")
}

const norm = (p: string) => p.replace(/\\/g, "/")

/**
 * One level of the map: the direct children of `folder` ("" = the project root). A sub-folder is one tile sized by
 * √(its file count) and shaded by its newest file, so a 519-file folder doesn't swallow its siblings; click to open.
 */
function buildLevel(files: ExplorerFile[], folder: string, paint: Paint): TreemapNode[] {
  const prefix = folder ? `${folder}/` : ""
  const folders = new Map<string, { count: number; newest: string }>()
  const leaves: TreemapNode[] = []
  for (const file of files) {
    const path = norm(file.path)
    if (!path.startsWith(prefix)) continue
    const rest = path.slice(prefix.length)
    const slash = rest.indexOf("/")
    if (slash < 0) {
      leaves.push({ name: rest.replace(/\.md$/i, ""), value: 1, path: file.path, itemStyle: { color: freshnessColor(file.mtime, paint) } })
      continue
    }
    const name = rest.slice(0, slash)
    const cur = folders.get(name)
    folders.set(name, { count: (cur?.count ?? 0) + 1, newest: cur && cur.newest > file.mtime ? cur.newest : file.mtime })
  }
  const folderNodes = [...folders].map(([name, { count, newest }]): TreemapNode => ({
    name, value: Math.sqrt(count), folder: prefix + name, count, itemStyle: { color: freshnessColor(newest, paint) },
  }))
  return [...folderNodes, ...leaves].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
}

/** `folder`, or the nearest level that still has files; one lone sub-folder and nothing else is opened for you. */
function effectiveFolder(files: ExplorerFile[], folder: string): string {
  let f = folder
  while (f && !files.some((x) => norm(x.path).startsWith(`${f}/`))) f = f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : ""
  for (;;) {
    const prefix = f ? `${f}/` : ""
    const under = files.map((x) => norm(x.path)).filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length))
    const tops = new Set(under.map((p) => (p.includes("/") ? p.slice(0, p.indexOf("/")) : "")))
    if (tops.size !== 1 || tops.has("")) return f
    f = prefix + [...tops][0]
  }
}

export function FileTreemap({ files, onSelect }: FileTreemapProps) {
  const { t } = useT()
  const theme = useSyncExternalStore(subscribeTheme, readTokens, () => "")
  const paint = useMemo(() => painter(theme), [theme])
  const [picked, setPicked] = useState("")
  const folder = useMemo(() => effectiveFolder(files, picked), [files, picked])
  const level = useMemo(() => buildLevel(files, folder, paint), [files, folder, paint])
  const crumbs = folder ? folder.split("/") : []

  const option = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: {
        backgroundColor: paint("surface"),
        borderColor: paint("border2"),
        borderWidth: 1,
        padding: [6, 10],
        textStyle: { color: paint("txt"), fontSize: 12 },
        formatter: (info: { name: string; data: TreemapNode }) => {
          const { name, data } = info
          const esc = (x: string) => x.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)
          return data.path
            ? `<span style="color:${paint("muted")};font-size:11px;font-family:var(--font-mono)">${esc(data.path)}</span>`
            : `<span style="font-weight:600">${esc(name)}/</span> <span style="color:${paint("muted")}">${data.count ?? 0}</span>`
        },
      },
      series: [
        {
          type: "treemap",
          data: level,
          roam: false,
          // one level only: a folder click opens it here (React state), never ECharts' own zoom
          nodeClick: false,
          breadcrumb: { show: false },
          width: "100%",
          height: "100%",
          top: 4,
          bottom: 4,
          left: 4,
          right: 4,
          squareRatio: 0.7,
          label: {
            show: true,
            formatter: (p: { name: string; data: TreemapNode }) => (p.data.folder ? `{f|${p.name}/}\n{n|${p.data.count}}` : p.name),
            fontSize: 12,
            fontWeight: 500,
            color: paint("txt"),
            overflow: "truncate",
            padding: [4, 6],
            rich: {
              f: { fontSize: 13, fontWeight: 600, color: paint("txt"), lineHeight: 18 },
              n: { fontSize: 11, color: paint("muted"), fontFamily: "monospace", lineHeight: 16 },
            },
          },
          itemStyle: { borderColor: paint("bg"), borderWidth: 2, gapWidth: 2 },
          emphasis: {
            label: { color: paint("txt") },
            itemStyle: { borderColor: paint("border2"), borderWidth: 2 },
          },
        },
      ],
    }),
    [level, paint]
  )

  function handleClick(params: { data?: TreemapNode }) {
    const d = params?.data
    if (d?.folder) setPicked(d.folder)
    else if (d?.path) onSelect(d.path)
  }

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm h-full">
        {t("docs.noFiles")}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border px-4 py-2">
        <nav aria-label={t("docs.treemapAll")} className="flex min-w-0 flex-wrap items-center gap-1 font-mono text-[11px]">
          {["", ...crumbs].map((name, i) => {
            const path = crumbs.slice(0, i).join("/")
            const current = path === folder
            return (
              <span key={path || "/"} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3 text-muted" aria-hidden />}
                <button
                  type="button"
                  disabled={current}
                  aria-current={current ? "page" : undefined}
                  onClick={() => setPicked(path)}
                  className="rounded-sm px-1 py-0.5 text-muted outline-none hover:text-txt focus-visible:ring-2 focus-visible:ring-accent disabled:text-txt"
                >
                  {i === 0 ? t("docs.treemapAll") : <span data-user-content>{name}</span>}
                </button>
              </span>
            )
          })}
        </nav>
        <FreshnessLegend tiles />
      </div>
      <div className="min-h-0 flex-1">
        <ReactECharts
          option={option}
          onEvents={{ click: handleClick }}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
        />
      </div>
    </div>
  )
}
