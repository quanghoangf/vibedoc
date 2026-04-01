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
  if (days <= 7) return "#4ade80"    // green-400 — recent
  if (days <= 28) return "#b59310"   // yellow-400 ~70% — mid
  return "#4b5563"                   // gray-600 — old
}

function buildTreemapData(files: ExplorerFile[]): TreemapNode[] {
  const root: TreemapNode[] = []
  const folderMap = new Map<string, TreemapNode>()

  // Sort so parent folders are created before children
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path))

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
        formatter: (info: { name: string; data: TreemapNode }) => {
          const { name, data } = info
          return data.path
            ? `<span style="font-size:12px">${data.path}</span>`
            : `<span style="font-size:12px;font-weight:600">${name}/</span>`
        },
      },
      series: [
        {
          type: "treemap",
          data: treeData,
          roam: false,
          nodeClick: "zoomToNode",
          leafDepth: 1,
          width: "100%",
          height: "100%",
          top: 0,
          bottom: 32,
          left: 0,
          right: 0,
          squareRatio: 0.7,
          breadcrumb: {
            show: true,
            bottom: 0,
            height: 28,
            itemStyle: {
              color: "#1e1e2e",
              borderColor: "#3b3b5c",
              textStyle: { color: "#a0a0b8", fontSize: 11 },
            },
            emptyItemWidth: 25,
          },
          label: {
            show: true,
            formatter: "{b}",
            fontSize: 11,
            color: "#e2e2f0",
            overflow: "truncate",
          },
          upperLabel: {
            show: true,
            height: 22,
            fontSize: 11,
            fontWeight: 600,
            color: "#e2e2f0",
            backgroundColor: "rgba(30,30,46,0.7)",
            padding: [3, 6],
          },
          itemStyle: {
            borderColor: "#12121e",
            borderWidth: 2,
            gapWidth: 2,
          },
          levels: [
            {
              // top-level folders
              itemStyle: {
                borderColor: "#3b3b5c",
                borderWidth: 3,
                gapWidth: 3,
              },
              upperLabel: { show: true },
            },
            {
              // second-level folders
              itemStyle: {
                borderColor: "#2a2a45",
                borderWidth: 2,
                gapWidth: 2,
              },
              upperLabel: { show: true },
            },
            {
              // files (leaves)
              itemStyle: {
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
