"use client"

import { useState, KeyboardEvent } from "react"
import { Search, X } from "lucide-react"
import { TECH_CATEGORIES, TECH_PRESETS } from "@/lib/tech-stacks"
import { cn } from "@/lib/utils"

interface TechStackInputProps {
  value: string[]
  onChange: (tags: string[]) => void
}

export function TechStackInput({ value, onChange }: TechStackInputProps) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("language")

  const isSearching = search.trim().length > 0

  const applyPreset = (techs: string[]) => {
    const toAdd = techs.filter(t => !value.includes(t))
    if (toAdd.length > 0) onChange([...value, ...toAdd])
  }

  const toggleTech = (tech: string) => {
    if (value.includes(tech)) {
      onChange(value.filter(t => t !== tech))
    } else {
      onChange([...value, tech])
    }
  }

  const addCustom = (text: string) => {
    const t = text.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setSearch("")
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const exactMatch = TECH_CATEGORIES.flatMap(c => c.techs).some(
        t => t.toLowerCase() === search.toLowerCase()
      )
      if (!exactMatch && search.trim()) {
        addCustom(search)
      }
    } else if (e.key === "Escape") {
      setSearch("")
    }
  }

  // Search results: filter all categories
  const searchResults = isSearching
    ? TECH_CATEGORIES.map(cat => ({
        ...cat,
        items: cat.techs.filter(t => t.toLowerCase().includes(search.toLowerCase())),
      })).filter(cat => cat.items.length > 0)
    : []

  // Active category pills
  const activeCategoryTechs = TECH_CATEGORIES.find(c => c.id === activeCategory)?.techs ?? []

  // Show "add custom" hint when search has text but no exact match
  const hasExactMatch = TECH_CATEGORIES.flatMap(c => c.techs).some(
    t => t.toLowerCase() === search.toLowerCase()
  )
  const showCustomHint = isSearching && !hasExactMatch && search.trim().length > 0

  return (
    <div className="space-y-3">
      {/* Quick Presets */}
      <div>
        <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wider">Quick Presets</p>
        <div className="flex flex-wrap gap-2">
          {TECH_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.techs)}
              className="px-3 py-1 rounded-md border border-border text-xs text-txt hover:border-accent hover:text-accent transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search technologies..."
          className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-surface2 text-txt text-sm outline-none placeholder:text-muted focus:border-accent transition-colors"
        />
        {isSearching && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-txt transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category tabs — hidden while searching */}
      {!isSearching && (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
          {TECH_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0",
                activeCategory === cat.id
                  ? "bg-accent text-white"
                  : "bg-surface2 text-muted hover:text-txt hover:bg-surface"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Pill grid */}
      {!isSearching ? (
        <div className="flex flex-wrap gap-2">
          {activeCategoryTechs.map(tech => (
            <button
              key={tech}
              type="button"
              onClick={() => toggleTech(tech)}
              className={cn(
                "px-3 py-1 rounded-full text-sm border transition-colors",
                value.includes(tech)
                  ? "bg-accent/15 border-accent text-accent"
                  : "bg-surface2 border-border text-txt hover:border-accent/50 hover:text-accent/80"
              )}
            >
              {tech}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {searchResults.map(cat => (
            <div key={cat.id}>
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-1.5">{cat.label}</p>
              <div className="flex flex-wrap gap-2">
                {cat.items.map(tech => (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => toggleTech(tech)}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm border transition-colors",
                      value.includes(tech)
                        ? "bg-accent/15 border-accent text-accent"
                        : "bg-surface2 border-border text-txt hover:border-accent/50 hover:text-accent/80"
                    )}
                  >
                    {tech}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {showCustomHint && (
            <p className="text-xs text-muted">
              Press <kbd className="px-1 py-0.5 rounded bg-surface border border-border text-xs">Enter</kbd> to add &quot;{search}&quot;
            </p>
          )}
        </div>
      )}

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted mb-2">Selected ({value.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {value.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/15 text-accent text-sm font-medium"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onChange(value.filter(t => t !== tag))}
                  className="hover:text-accent/70 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
