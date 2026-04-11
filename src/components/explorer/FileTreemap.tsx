"use client"

import dynamic from "next/dynamic"
import { useMemo } from "react"
import type { ExplorerFile } from "@/types"

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

function freshnessColor(mtime: string): string {
  const age = Date.now() - new Date(mtime).getTime()
  const days = age / (1000 * 60 * 60 * 24)
  if (days <= 7) return "#059669"   // emerald-600 — recent (readable on dark)
  if (days <= 28) return "#b45309"  // amber-700 — mid
  return "#334155"                  // slate-700 — old
}

function buildTreemapData(files: ExplorerFile[]): TreemapNode[] {
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
      itemStyle: { color: freshnessColor(file.mtime) },
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
  const treeData = useMemo(() => buildTreemapData(files), [files])

  const option = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: {
        backgroundColor: "#1e293b",
        borderColor: "#334155",
        borderWidth: 1,
        padding: [6, 10],
        textStyle: { color: "#f1f5f9", fontSize: 12 },
        formatter: (info: { name: string; data: TreemapNode }) => {
          const { name, data } = info
          return data.path
            ? `<span style="color:#94a3b8;font-size:11px">${data.path}</span>`
            : `<span style="font-weight:600">${name}/</span>`
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
              color: "#1e293b",
              borderColor: "#334155",
              borderWidth: 1,
              shadowBlur: 0,
              textStyle: { color: "#94a3b8", fontSize: 11, fontFamily: "inherit" },
            },
            emptyItemWidth: 20,
          },
          // labels on leaf nodes
          label: {
            show: true,
            formatter: "{b}",
            fontSize: 12,
            fontWeight: 500,
            color: "#f1f5f9",
            textShadowBlur: 3,
            textShadowColor: "rgba(0,0,0,0.8)",
            overflow: "truncate",
            padding: [4, 6],
          },
          // labels on folder header bar
          upperLabel: {
            show: true,
            height: 24,
            fontSize: 12,
            fontWeight: 700,
            color: "#f8fafc",
            backgroundColor: "rgba(15,23,42,0.85)",
            borderRadius: [4, 4, 0, 0],
            padding: [4, 8],
            textShadowBlur: 0,
          },
          itemStyle: {
            borderColor: "#0f172a",
            borderWidth: 1,
            gapWidth: 1,
          },
          emphasis: {
            label: { color: "#ffffff", fontWeight: 700 },
            upperLabel: { color: "#ffffff", backgroundColor: "rgba(99,102,241,0.9)" },
            itemStyle: { borderColor: "#6366f1", borderWidth: 2 },
          },
          levels: [
            {
              // top-level folders — large colored blocks
              color: ["#1e3a5f", "#1a3a2e", "#3b2a1a", "#2d1b4e", "#1a2e3b", "#3b1a1a"],
              itemStyle: {
                borderColor: "#0f172a",
                borderWidth: 3,
                gapWidth: 4,
              },
              upperLabel: {
                show: true,
                height: 28,
                fontSize: 13,
                fontWeight: 700,
                color: "#f8fafc",
                backgroundColor: "rgba(15,23,42,0.9)",
              },
            },
            {
              // sub-folders
              itemStyle: {
                borderColor: "#0f172a",
                borderWidth: 2,
                gapWidth: 2,
              },
              upperLabel: { show: true },
            },
            {
              // leaf files — color comes from itemStyle.color set per-node (freshness)
              itemStyle: {
                borderColor: "rgba(15,23,42,0.6)",
                borderWidth: 1,
                gapWidth: 1,
              },
            },
          ],
        },
      ],
    }),
    [treeData]
  )

  function handleClick(params: { data?: TreemapNode }) {
    if (!params?.data?.path) return
    onSelect(params.data.path)
  }

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm h-full">
        No files to display
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
