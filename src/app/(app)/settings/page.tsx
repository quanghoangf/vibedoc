"use client"

import { Suspense, useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { useT } from "@/context/LanguageContext"
import type { MessageKey } from "@/i18n"
import { Palette, Type, FolderCog, Plug, Zap, Bot, Settings, Columns3, AppWindow, ShieldCheck, GitBranch } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeSettings } from "@/components/settings/ThemeSettings"
import { EditorSettings } from "@/components/settings/EditorSettings"
import { ProjectSettings } from "@/components/settings/ProjectSettings"
import { MCPSettings } from "@/components/settings/MCPSettings"
import { SkillsSettings } from "@/components/settings/SkillsSettings"
import { AgentsSettings } from "@/components/settings/AgentsSettings"
import { StatusesSettings } from "@/components/settings/StatusesSettings"
import { FrontendSettings } from "@/components/settings/FrontendSettings"
import { PrivacySettings } from "@/components/settings/PrivacySettings"
import { WorkersSettings } from "@/components/settings/WorkersSettings"
import { setStatusDefs } from "@/components/shared/status-defs"
import { statusDefs } from "@/lib/statuses"
import type { AppSettings, Skill, Agent } from "@/lib/settings"
import { DEFAULT_SETTINGS, DEFAULT_SKILLS, DEFAULT_AGENTS } from "@/lib/settings"
import { applyTheme, applyAccent, applyFontSize, applyFonts } from "@/lib/applySettings"
import { toast } from "@/components/ui/toast"

type Tab = { id: string; label: MessageKey; icon: typeof Palette }

/** Three small groups (ids stay the ?tab= values): what the agent gets, what the project is, what is yours. */
const GROUPS: { label: MessageKey; tabs: Tab[] }[] = [
  {
    label: "settings.groupAgent",
    tabs: [
      { id: "connect", label: "connect.tab", icon: Plug },
      { id: "workers", label: "workers.settingsTab", icon: GitBranch },
      { id: "skills", label: "settings.tabSkills", icon: Zap },
      { id: "agents", label: "settings.tabAgents", icon: Bot },
    ],
  },
  {
    label: "settings.groupProject",
    tabs: [
      { id: "project", label: "settings.tabProject", icon: FolderCog },
      { id: "statuses", label: "settings.tabStatuses", icon: Columns3 },
      { id: "frontend", label: "settings.tabFrontend", icon: AppWindow },
    ],
  },
  {
    label: "settings.groupYou",
    tabs: [
      { id: "appearance", label: "settings.tabAppearance", icon: Palette },
      { id: "editor", label: "settings.tabEditor", icon: Type },
      { id: "privacy", label: "settings.tabPrivacy", icon: ShieldCheck },
    ],
  },
]
const TABS = GROUPS.flatMap((g) => g.tabs)

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsSections />
    </Suspense>
  )
}

function SettingsSections() {
  const { rootParam, setEditorSettings, setAutoRefreshSeconds } = useApp()
  const { t } = useT()
  const tabLabel = (l: MessageKey) => t(l)
  // ?tab=connect is the deep link to a section (R081: empty states and the welcome screen link to Connect)
  const tabParam = useSearchParams().get("tab")
  const [activeTab, setActiveTab] = useState(TABS.some(x => x.id === tabParam) ? tabParam as string : "appearance")
  // A link to another ?tab= while Settings is open (e.g. the header's "Settings → Connect agent") switches the section
  const [seenParam, setSeenParam] = useState(tabParam)
  if (tabParam !== seenParam) {
    setSeenParam(tabParam)
    if (TABS.some(x => x.id === tabParam)) setActiveTab(tabParam as string)
  }
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [skills, setSkills] = useState<Skill[]>(DEFAULT_SKILLS)
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // when the last autosave landed: the autosave tabs show "Saved" under their title
  const [savedAt, setSavedAt] = useState<number | null>(null)

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

  /** PUT one settings file; a non-2xx throws (fetch alone only throws on a network error). */
  const put = async (type: "settings" | "skills" | "agents", body: unknown) => {
    const res = await fetch(`/api/settings${rootParam}&type=${type}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  }

  /**
   * Optimistic save: show `next` now; on failure put `prev` back and offer "Couldn't save · Retry".
   * Resolves true once it is on disk.
   */
  const save = async <T,>(type: "settings" | "skills" | "agents", prev: T, next: T, set: (v: T) => void, retry: () => void, after?: () => void) => {
    setSaving(true)
    set(next)
    try {
      await put(type, next)
      after?.()
      setSavedAt(Date.now())
      return true
    } catch (e) {
      console.warn(`[vibedoc] ${type} not saved:`, e)
      set(prev)
      toast(t("settings.saveFailed"), { action: { label: t("settings.retry"), onClick: retry } })
      return false
    } finally {
      setSaving(false)
    }
  }

  const saveSettings = (next: AppSettings): Promise<boolean> => save("settings", settings, next, setSettings, () => { void saveSettings(next) }, () => {
    applyTheme(next.theme)
    applyAccent(next.accentColor)
    applyFontSize(next.fontSize)
    applyFonts(next)
    setEditorSettings(next.editor)
    setAutoRefreshSeconds(next.project?.autoRefresh ?? 0)
    setStatusDefs(statusDefs(next.statuses))
  })
  const saveSkills = (next: Skill[]): Promise<boolean> => save("skills", skills, next, setSkills, () => { void saveSkills(next) })
  const saveAgents = (next: Agent[]): Promise<boolean> => save("agents", agents, next, setAgents, () => { void saveAgents(next) })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted">{t("settings.loadingSettings")}</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col sm:flex-row">
      {/* Phone: the sections as a scrolling tab strip instead of the sidebar; the right-edge fade says it scrolls */}
      <div className="relative shrink-0 border-b border-border sm:hidden">
        <nav aria-label={t("settings.sections")} className="flex gap-1 overflow-x-auto px-3 py-2 pr-10 [scrollbar-width:none]">
          {GROUPS.map((group, gi) => (
            <div key={group.label} className="flex shrink-0 items-center gap-1">
              {gi > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-border" />}
              {group.tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={activeTab === tab.id ? "page" : undefined}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    activeTab === tab.id ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface2 hover:text-txt",
                  )}
                >
                  {tabLabel(tab.label)}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-bg to-transparent" />
      </div>

      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-sidebar sm:block">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-accent" />
            <h1 className="font-semibold text-txt">{t("settings.settings")}</h1>
          </div>
        </div>
        <nav aria-label={t("settings.sections")} className="space-y-3 p-2">
          {GROUPS.map(group => (
            <div key={group.label} role="group" aria-labelledby={`settings-group-${group.label}`}>
              <div id={`settings-group-${group.label}`} className="flex h-8 items-center px-3 text-xs font-medium text-muted">{t(group.label)}</div>
              {group.tabs.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                      activeTab === tab.id
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-muted hover:text-txt hover:bg-surface2"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tabLabel(tab.label)}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
          {saving && (
            <div className="fixed top-4 right-4 bg-accent text-accent-fg px-3 py-1.5 rounded-lg text-sm shadow-lg">
              {t("settings.saving")}
            </div>
          )}

          {activeTab === "appearance" && (
            <ThemeSettings settings={settings} onSave={saveSettings} savedAt={savedAt} />
          )}
          {activeTab === "editor" && (
            <EditorSettings settings={settings} onSave={saveSettings} savedAt={savedAt} />
          )}
          {activeTab === "project" && (
            <ProjectSettings settings={settings} onSave={saveSettings} savedAt={savedAt} />
          )}
          {activeTab === "statuses" && (
            <StatusesSettings settings={settings} onSave={saveSettings} savedAt={savedAt} />
          )}
          {activeTab === "frontend" && <FrontendSettings rootParam={rootParam} />}
          {activeTab === "connect" && (
            <MCPSettings settings={settings} onSave={saveSettings} savedAt={savedAt} />
          )}
          {activeTab === "skills" && (
            <SkillsSettings skills={skills} onSave={saveSkills} />
          )}
          {activeTab === "privacy" && <PrivacySettings rootParam={rootParam} />}
          {activeTab === "workers" && <WorkersSettings settings={settings} onSave={saveSettings} rootParam={rootParam} />}
          {activeTab === "agents" && (
            <AgentsSettings agents={agents} skills={skills} onSave={saveAgents} />
          )}
        </div>
      </div>
    </div>
  )
}
