"use client"

import dynamic from "next/dynamic"
import { useMemo, useSyncExternalStore } from "react"
import type { ExplorerFile } from "@/types"
import { useT } from "@/context/LanguageContext"

// ECharts uses browser APIs — must be dynamically imported with ssr: false
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false })

interface TreemapNode {
  name: string
  value?: number
  path?: string
  itemStyle?: { color: string }
  children?: TreemapNode[]
}

interface FileTreemapProps {
  files: ExplorerFile[]
  onSelect: (path: string) => void
}

// The canvas can't read CSS vars, so the design tokens are read off the root as computed now (follows .dark and the
// accent setting) and re-read when either changes
const TOKENS = ["bg", "surface", "surface2", "border", "border2", "txt", "muted", "accent", "teal", "amber"] as const
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

/** Freshness on the status inks: teal this week, amber this month, a plain surface after that. */
function freshnessColor(mtime: string, paint: Paint): string {
  const days = (Date.now() - new Date(mtime).getTime()) / (1000 * 60 * 60 * 24)
  if (days <= 7) return paint("teal", 0.45)
  if (days <= 28) return paint("amber", 0.4)
  return paint("surface2")
}

function buildTreemapData(files: ExplorerFile[], paint: Paint): TreemapNode[] {
  const root: TreemapNode[] = []
  const folderMap = new Map<string, TreemapNode>()

  // Normalize to forward slashes (paths may have backslashes on Windows/WSL)
  // and skip root-level files (no folder) — they'd appear as orphan tiles.
  const sorted = [...files]
    .map((f) => ({ ...f, path: f.path.replace(/\\/g, "/") }))
    .filter((f) => f.path.includes("/"))
    .sort((a, b) => a.path.localeCompare(b.path))

  for (const file of sorted) {
    const parts = file.path.split("/")
    const fileName = parts[parts.length - 1].replace(/\.md$/i, "")

    const leaf: TreemapNode = {
      name: fileName,
      value: 1,
      path: file.path,
      itemStyle: { color: freshnessColor(file.mtime, paint) },
    }

    if (parts.length === 1) {
      // Top-level file
      root.push(leaf)
    } else {
      // Ensure each ancestor folder exists
      for (let depth = 1; depth < parts.length; depth++) {
        const folderPath = parts.slice(0, depth).join("/")
        if (!folderMap.has(folderPath)) {
          const folderNode: TreemapNode = {
            name: parts[depth - 1],
            // value will be summed up after tree is built
            children: [],
          }
          folderMap.set(folderPath, folderNode)

          if (depth === 1) {
            root.push(folderNode)
          } else {
            const parentPath = parts.slice(0, depth - 1).join("/")
            const parent = folderMap.get(parentPath)
            if (parent) parent.children!.push(folderNode)
          }
        }
      }

      // Attach leaf to its immediate parent folder
      const parentPath = parts.slice(0, parts.length - 1).join("/")
      const parent = folderMap.get(parentPath)
      if (parent) parent.children!.push(leaf)
    }
  }

  // Give each folder a value = number of descendant files so ECharts sizes it correctly
  function sumValues(node: TreemapNode): number {
    if (!node.children || node.children.length === 0) return node.value ?? 1
    const total = node.children.reduce((acc, child) => acc + sumValues(child), 0)
    node.value = total
    return total
  }
  root.forEach(sumValues)

  return root
}

export function FileTreemap({ files, onSelect }: FileTreemapProps) {
  const { t } = useT()
  const theme = useSyncExternalStore(subscribeTheme, readTokens, () => "")
  const paint = useMemo(() => painter(theme), [theme])
  const treeData = useMemo(() => buildTreemapData(files, paint), [files, paint])

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
            : `<span style="font-weight:600">${esc(name)}/</span>`
        },
      },
      series: [
        {
          type: "treemap",
          data: treeData,
          roam: false,
          leafDepth: 1,
          width: "100%",
          height: "100%",
          top: 4,
          bottom: 36,
          left: 4,
          right: 4,
          squareRatio: 0.7,
          breadcrumb: {
            show: true,
            bottom: 4,
            height: 26,
            gap: 6,
            itemStyle: {
              color: paint("surface"),
              borderColor: paint("border"),
              borderWidth: 1,
              shadowBlur: 0,
              textStyle: { color: paint("muted"), fontSize: 11, fontFamily: "inherit" },
            },
            emptyItemWidth: 20,
          },
          // labels on leaf nodes: text colour on a tinted tile, no glow
          label: {
            show: true,
            formatter: "{b}",
            fontSize: 12,
            fontWeight: 500,
            color: paint("txt"),
            overflow: "truncate",
            padding: [4, 6],
          },
          // labels on folder header bar
          upperLabel: {
            show: true,
            height: 24,
            fontSize: 12,
            fontWeight: 600,
            color: paint("txt"),
            backgroundColor: paint("surface"),
            borderRadius: [4, 4, 0, 0],
            padding: [4, 8],
            textShadowBlur: 0,
          },
          itemStyle: {
            borderColor: paint("bg"),
            borderWidth: 1,
            gapWidth: 1,
          },
          emphasis: {
            label: { color: paint("txt"), fontWeight: 600 },
            upperLabel: { color: paint("txt"), backgroundColor: paint("surface2") },
            itemStyle: { borderColor: paint("accent"), borderWidth: 2 },
          },
          levels: [
            {
              // top-level folders: flat surfaces; colour belongs to the files' freshness
              color: [paint("surface")],
              itemStyle: {
                borderColor: paint("bg"),
                borderWidth: 3,
                gapWidth: 4,
              },
              upperLabel: {
                show: true,
                height: 28,
                fontSize: 13,
                fontWeight: 600,
                color: paint("txt"),
                backgroundColor: paint("surface"),
              },
            },
            {
              // sub-folders
              itemStyle: {
                borderColor: paint("border"),
                borderWidth: 2,
                gapWidth: 2,
              },
              upperLabel: { show: true },
            },
            {
              // leaf files — color comes from itemStyle.color set per-node (freshness)
              itemStyle: {
                borderColor: paint("bg"),
                borderWidth: 1,
                gapWidth: 1,
              },
            },
          ],
        },
      ],
    }),
    [treeData, paint]
  )

  function handleClick(params: { data?: TreemapNode }) {
    if (!params?.data?.path) return
    onSelect(params.data.path)
  }

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm h-full">
        {t("docs.noFiles")}
      </div>
    )
  }

  return (
    <ReactECharts
      option={option}
      onEvents={{ click: handleClick }}
      style={{ height: "100%", width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
    />
  )
}
