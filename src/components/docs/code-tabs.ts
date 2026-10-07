"use client"

import { useEffect, type RefObject } from "react"

// Code tabs (R089) on rendered markdown: the markup comes from src/lib/md-code-tabs.ts (first tab selected, other
// panels hidden). One delegated listener per renderer: click selects; ArrowLeft/Right (wrapping), Home, End move.
// The chosen tab is not remembered: a re-render (live preview typing) starts again on the first tab.

let seq = 0

const tabsOf = (group: Element) => Array.from(group.querySelectorAll<HTMLElement>(":scope > [role=tablist] > [role=tab]"))
const panelsOf = (group: Element) => Array.from(group.querySelectorAll<HTMLElement>(":scope > [role=tabpanel]"))

function select(group: Element, index: number, focus: boolean) {
  const panels = panelsOf(group)
  tabsOf(group).forEach((tab, i) => {
    tab.setAttribute("aria-selected", String(i === index))
    tab.tabIndex = i === index ? 0 : -1
    panels[i]?.toggleAttribute("hidden", i !== index)
    if (i === index && focus) tab.focus()
  })
}

export function useCodeTabs(containerRef: RefObject<HTMLElement | null>, html: string) {
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    for (const group of root.querySelectorAll("[data-code-group]")) {
      const n = ++seq
      const panels = panelsOf(group)
      tabsOf(group).forEach((tab, i) => {
        tab.id = `code-tab-${n}-${i}`
        const panel = panels[i]
        if (!panel) return
        panel.id = `code-panel-${n}-${i}`
        tab.setAttribute("aria-controls", panel.id)
        panel.setAttribute("aria-labelledby", tab.id)
      })
    }
    const tabAt = (e: Event) => {
      const tab = (e.target as Element | null)?.closest?.("[role=tab]")
      const group = tab?.parentElement?.parentElement
      if (!tab || !group?.matches("[data-code-group]") || !root.contains(group)) return null
      return { group, index: tabsOf(group).indexOf(tab as HTMLElement) }
    }
    const onClick = (e: MouseEvent) => {
      const hit = tabAt(e)
      if (hit) select(hit.group, hit.index, true)
    }
    const onKey = (e: KeyboardEvent) => {
      const hit = tabAt(e)
      if (!hit) return
      const count = tabsOf(hit.group).length
      const next = { ArrowRight: hit.index + 1, ArrowLeft: hit.index - 1, Home: 0, End: count - 1 }[e.key]
      if (next === undefined) return
      e.preventDefault()
      select(hit.group, (next + count) % count, true)
    }
    root.addEventListener("click", onClick)
    root.addEventListener("keydown", onKey)
    return () => {
      root.removeEventListener("click", onClick)
      root.removeEventListener("keydown", onKey)
    }
  }, [containerRef, html])
}
