"use client"

import { useState, useEffect, useCallback } from "react"
import { useApp } from "@/context/AppContext"
import { Palette, Type, FolderCog, Plug, Zap, Bot, Settings, Columns3, AppWindow } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeSettings } from "@/components/settings/ThemeSettings"
import { EditorSettings } from "@/components/settings/EditorSettings"
import { ProjectSettings } from "@/components/settings/ProjectSettings"
import { MCPSettings } from "@/components/settings/MCPSettings"
import { SkillsSettings } from "@/components/settings/SkillsSettings"
import { AgentsSettings } from "@/components/settings/AgentsSettings"
import { StatusesSettings } from "@/components/settings/StatusesSettings"
import { FrontendSettings } from "@/components/settings/FrontendSettings"
import { setStatusDefs } from "@/components/shared/status-defs"
import { statusDefs } from "@/lib/statuses"
import type { AppSettings, Skill, Agent } from "@/lib/settings"
import { DEFAULT_SETTINGS, DEFAULT_SKILLS, DEFAULT_AGENTS } from "@/lib/settings"
import { applyTheme, applyAccent, applyFontSize, applyFonts } from "@/lib/applySettings"

const TABS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "editor", label: "Editor", icon: Type },
  { id: "project", label: "Project", icon: FolderCog },
  { id: "statuses", label: "Statuses", icon: Columns3 },
  { id: "frontend", label: "Frontend app", icon: AppWindow },
  { id: "mcp", label: "MCP", icon: Plug },
  { id: "skills", label: "Skills", icon: Zap },
  { id: "agents", label: "Agents", icon: Bot },
]

export default function SettingsPage() {
  const { rootParam, setEditorSettings, setAutoRefreshSeconds } = useApp()
  const [activeTab, setActiveTab] = useState("appearance")
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [skills, setSkills] = useState<Skill[]>(DEFAULT_SKILLS)
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`/api/settings${rootParam}&type=all`)
      const data = await res.json()
      setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
      setSkills(data.skills || DEFAULT_SKILLS)
      setAgents(data.agents || DEFAULT_AGENTS)
    } catch {}
    setLoading(false)
  }, [rootParam])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const saveSettings = async (newSettings: AppSettings) => {
    setSaving(true)
    setSettings(newSettings)
    try {
      await fetch(`/api/settings${rootParam}&type=settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      })
      applyTheme(newSettings.theme)
      applyAccent(newSettings.accentColor)
      applyFontSize(newSettings.fontSize)
      applyFonts(newSettings)
      setEditorSettings(newSettings.editor)
      setAutoRefreshSeconds(newSettings.project?.autoRefresh ?? 0)
      setStatusDefs(statusDefs(newSettings.statuses))
    } catch {}
    setSaving(false)
  }

  const saveSkills = async (newSkills: Skill[]) => {
    setSaving(true)
    setSkills(newSkills)
    try {
      await fetch(`/api/settings${rootParam}&type=skills`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSkills),
      })
    } catch {}
    setSaving(false)
  }

  const saveAgents = async (newAgents: Agent[]) => {
    setSaving(true)
    setAgents(newAgents)
    try {
      await fetch(`/api/settings${rootParam}&type=agents`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAgents),
      })
    } catch {}
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col sm:flex-row">
      {/* Phone: the sections as a scrolling tab strip instead of the sidebar */}
      <nav aria-label="Settings sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 sm:hidden [scrollbar-width:none]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              activeTab === tab.id ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface2 hover:text-txt",
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-sidebar sm:block">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-accent" />
            <h1 className="font-semibold text-txt">Settings</h1>
          </div>
        </div>
        <nav className="p-2">
          {TABS.map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  activeTab === tab.id
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-muted hover:text-txt hover:bg-surface2"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
          {saving && (
            <div className="fixed top-4 right-4 bg-accent text-accent-fg px-3 py-1.5 rounded-lg text-sm shadow-lg">
              Saving...
            </div>
          )}

          {activeTab === "appearance" && (
            <ThemeSettings settings={settings} onSave={saveSettings} />
          )}
          {activeTab === "editor" && (
            <EditorSettings settings={settings} onSave={saveSettings} />
          )}
          {activeTab === "project" && (
            <ProjectSettings settings={settings} onSave={saveSettings} />
          )}
          {activeTab === "statuses" && (
            <StatusesSettings settings={settings} onSave={saveSettings} />
          )}
          {activeTab === "frontend" && <FrontendSettings rootParam={rootParam} />}
          {activeTab === "mcp" && (
            <MCPSettings settings={settings} onSave={saveSettings} />
          )}
          {activeTab === "skills" && (
            <SkillsSettings skills={skills} onSave={saveSkills} />
          )}
          {activeTab === "agents" && (
            <AgentsSettings agents={agents} skills={skills} onSave={saveAgents} />
          )}
        </div>
      </div>
    </div>
  )
}
