"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, X, Check, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import type { Skill } from "@/lib/settings"
import { useT } from "@/context/LanguageContext"

interface SkillsSettingsProps {
  skills: Skill[]
  onSave: (skills: Skill[]) => void
}

const AVAILABLE_TOOLS = [
  "vibedoc_read_doc",
  "vibedoc_write_doc",
  "vibedoc_search_docs",
  "vibedoc_list_docs",
  "vibedoc_get_status",
  "vibedoc_list_tasks",
  "vibedoc_update_task",
  "vibedoc_read_memory",
  "vibedoc_update_memory",
  "vibedoc_save_entry",
  "vibedoc_delete_entry",
]

const SKILL_ICONS = ["🔧", "📝", "🧪", "🔍", "📊", "🔒", "⚡", "🎯", "💡", "🚀"]

export function SkillsSettings({ skills, onSave }: SkillsSettingsProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Skill | null>(null)
  const [isNew, setIsNew] = useState(false)
  const { t } = useT()

  const startEdit = (skill: Skill) => {
    setEditing(skill.id)
    setEditForm({ ...skill })
    setIsNew(false)
  }

  const startNew = () => {
    const newSkill: Skill = {
      id: `skill-${Date.now()}`,
      name: "",
      description: "",
      trigger: "/",
      prompt: "",
      tools: [],
      icon: "⚡",
    }
    setEditing(newSkill.id)
    setEditForm(newSkill)
    setIsNew(true)
  }

  const cancelEdit = () => {
    setEditing(null)
    setEditForm(null)
    setIsNew(false)
  }

  const saveEdit = () => {
    if (!editForm || !editForm.name.trim()) return
    
    if (isNew) {
      onSave([...skills, editForm])
    } else {
      onSave(skills.map(s => s.id === editForm.id ? editForm : s))
    }
    cancelEdit()
  }

  const deleteSkill = (id: string) => {
    if (!confirm(t("settings.deleteSkillConfirm"))) return
    onSave(skills.filter(s => s.id !== id))
  }

  const toggleTool = (tool: string) => {
    if (!editForm) return
    const tools = editForm.tools.includes(tool)
      ? editForm.tools.filter(x => x !== tool)
      : [...editForm.tools, tool]
    setEditForm({ ...editForm, tools })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-txt mb-1">{t("settings.tabSkills")}</h2>
          <p className="text-sm text-muted">{t("settings.skillsHint")}</p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-3 py-2 bg-accent text-accent-fg rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t("settings.addSkill")}
        </button>
      </div>

      <div className="space-y-3">
        {skills.map(skill => (
          <div key={skill.id}>
            {editing === skill.id && editForm ? (
              <div className="border border-accent rounded-lg p-4 space-y-4 bg-accent/5">
                <div className="flex items-center gap-3">
                  <select
                    value={editForm.icon || "⚡"}
                    onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                    className="w-12 h-10 text-center text-xl bg-surface2 border border-border rounded-lg"
                  >
                    {SKILL_ICONS.map(icon => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder={t("settings.skillName")}
                    className="bg-surface2"
                  />
                </div>
                
                <Input
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder={t("settings.description")}
                  className="bg-surface2"
                />

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted mb-1 block">{t("settings.trigger")}</label>
                    <Input
                      value={editForm.trigger}
                      onChange={(e) => setEditForm({ ...editForm, trigger: e.target.value })}
                      placeholder="/command"
                      className="bg-surface2 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted mb-1 block">{t("settings.systemPrompt")}</label>
                  <textarea
                    value={editForm.prompt}
                    onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                    placeholder={t("settings.promptPlaceholder")}
                    rows={4}
                    className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted mb-2 block">{t("settings.availableTools")}</label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_TOOLS.map(tool => (
                      <button
                        key={tool}
                        onClick={() => toggleTool(tool)}
                        className={cn(
                          "px-2 py-1 rounded-sm text-xs font-mono transition-colors",
                          editForm.tools.includes(tool)
                            ? "bg-accent/20 text-accent"
                            : "bg-surface2 text-muted hover:text-txt"
                        )}
                      >
                        {tool.replace("vibedoc_", "")}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 text-sm text-muted hover:text-txt transition-colors"
                  >
                    {t("settings.cancel")}
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={!editForm.name.trim()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-accent text-accent-fg rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    {t("settings.save")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 border border-border rounded-lg hover:border-accent/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-surface2 flex items-center justify-center text-xl shrink-0">
                  {skill.icon || "⚡"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span data-user-content className="font-medium text-txt">{skill.name}</span>
                    <code className="text-xs bg-surface2 px-1.5 py-0.5 rounded-sm text-accent">
                      {skill.trigger}
                    </code>
                  </div>
                  <p data-user-content className="text-sm text-muted mt-0.5">{skill.description}</p>
                  {skill.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {skill.tools.map(tool => (
                        <span key={tool} className="text-xs bg-surface2 px-1.5 py-0.5 rounded-sm text-muted">
                          {tool.replace("vibedoc_", "")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(skill)}
                    aria-label={t("settings.editName", { name: skill.name })}
                    className="p-1.5 rounded-sm hover:bg-surface2 text-muted hover:text-txt transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteSkill(skill.id)}
                    aria-label={t("settings.deleteName", { name: skill.name })}
                    className="p-1.5 rounded-sm hover:bg-red-500/10 text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isNew && editForm && (
          <div className="border border-accent rounded-lg p-4 space-y-4 bg-accent/5">
            {/* Same form as editing */}
            <div className="flex items-center gap-3">
              <select
                value={editForm.icon || "⚡"}
                onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                className="w-12 h-10 text-center text-xl bg-surface2 border border-border rounded-lg"
              >
                {SKILL_ICONS.map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder={t("settings.skillName")}
                className="bg-surface2"
              />
            </div>
            
            <Input
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              placeholder={t("settings.description")}
              className="bg-surface2"
            />

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted mb-1 block">{t("settings.trigger")}</label>
                <Input
                  value={editForm.trigger}
                  onChange={(e) => setEditForm({ ...editForm, trigger: e.target.value })}
                  placeholder="/command"
                  className="bg-surface2 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted mb-1 block">{t("settings.systemPrompt")}</label>
              <textarea
                value={editForm.prompt}
                onChange={(e) => setEditForm({ ...editForm, prompt: e.target.value })}
                placeholder={t("settings.promptPlaceholder")}
                rows={4}
                className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-muted mb-2 block">{t("settings.availableTools")}</label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TOOLS.map(tool => (
                  <button
                    key={tool}
                    onClick={() => toggleTool(tool)}
                    className={cn(
                      "px-2 py-1 rounded-sm text-xs font-mono transition-colors",
                      editForm.tools.includes(tool)
                        ? "bg-accent/20 text-accent"
                        : "bg-surface2 text-muted hover:text-txt"
                    )}
                  >
                    {tool.replace("vibedoc_", "")}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={cancelEdit}
                className="px-3 py-1.5 text-sm text-muted hover:text-txt transition-colors"
              >
                {t("settings.cancel")}
              </button>
              <button
                onClick={saveEdit}
                disabled={!editForm.name.trim()}
                className="flex items-center gap-2 px-3 py-1.5 bg-accent text-accent-fg rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {t("settings.save")}
              </button>
            </div>
          </div>
        )}

        {skills.length === 0 && !isNew && (
          <div className="text-center py-8 text-muted">
            <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{t("settings.noSkills")}</p>
            <p className="text-xs mt-1">{t("settings.noSkillsHint")}</p>
          </div>
        )}
      </div>
    </div>
  )
}
