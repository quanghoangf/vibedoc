"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Check, Bot } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import type { Agent, Skill } from "@/lib/settings"

interface AgentsSettingsProps {
  agents: Agent[]
  skills: Skill[]
  onSave: (agents: Agent[]) => void
}

const AGENT_ICONS = ["🤖", "📚", "🔒", "🧪", "📝", "🔧", "💡", "🎯", "🚀", "⚡"]

export function AgentsSettings({ agents, skills, onSave }: AgentsSettingsProps) {
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Agent | null>(null)
  const [isNew, setIsNew] = useState(false)

  const startEdit = (agent: Agent) => {
    setEditing(agent.id)
    setEditForm({ ...agent })
    setIsNew(false)
  }

  const startNew = () => {
    const newAgent: Agent = {
      id: `agent-${Date.now()}`,
      name: "",
      icon: "🤖",
      description: "",
      skills: [],
      prompt: "",
      active: true,
    }
    setEditing(newAgent.id)
    setEditForm(newAgent)
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
      onSave([...agents, editForm])
    } else {
      onSave(agents.map(a => a.id === editForm.id ? editForm : a))
    }
    cancelEdit()
  }

  const deleteAgent = (id: string) => {
    if (!confirm("Delete this agent?")) return
    onSave(agents.filter(a => a.id !== id))
  }

  const toggleActive = (id: string) => {
    onSave(agents.map(a => a.id === id ? { ...a, active: !a.active } : a))
  }

  const toggleSkill = (skillId: string) => {
    if (!editForm) return
    const newSkills = editForm.skills.includes(skillId)
      ? editForm.skills.filter(s => s !== skillId)
      : [...editForm.skills, skillId]
    setEditForm({ ...editForm, skills: newSkills })
  }

  const renderForm = (form: Agent) => (
    <div className="border border-accent rounded-lg p-4 space-y-4 bg-accent/5">
      <div className="flex items-center gap-3">
        <select
          value={form.icon}
          onChange={(e) => setEditForm({ ...form, icon: e.target.value })}
          className="w-12 h-10 text-center text-xl bg-surface2 border border-border rounded-lg"
        >
          {AGENT_ICONS.map(icon => (
            <option key={icon} value={icon}>{icon}</option>
          ))}
        </select>
        <Input
          value={form.name}
          onChange={(e) => setEditForm({ ...form, name: e.target.value })}
          placeholder="Agent name"
          className="bg-surface2"
        />
      </div>
      
      <Input
        value={form.description}
        onChange={(e) => setEditForm({ ...form, description: e.target.value })}
        placeholder="Description"
        className="bg-surface2"
      />

      <div>
        <label className="text-xs text-muted mb-2 block">Assigned Skills</label>
        <div className="flex flex-wrap gap-2">
          {skills.map(skill => (
            <button
              key={skill.id}
              onClick={() => toggleSkill(skill.id)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors",
                form.skills.includes(skill.id)
                  ? "bg-accent/20 text-accent"
                  : "bg-surface2 text-muted hover:text-txt"
              )}
            >
              <span>{skill.icon || "⚡"}</span>
              {skill.name}
            </button>
          ))}
          {skills.length === 0 && (
            <span className="text-xs text-muted">No skills available. Create skills first.</span>
          )}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted mb-1 block">Custom System Prompt</label>
        <textarea
          value={form.prompt}
          onChange={(e) => setEditForm({ ...form, prompt: e.target.value })}
          placeholder="Additional instructions for this agent..."
          rows={3}
          className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm resize-none"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditForm({ ...form, active: !form.active })}
            className={cn(
              "w-11 h-6 rounded-full transition-colors relative",
              form.active ? "bg-accent" : "bg-border"
            )}
          >
            <span
              className={cn(
                "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                form.active ? "left-6" : "left-1"
              )}
            />
          </button>
          <span className="text-sm text-muted">{form.active ? "Active" : "Inactive"}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={cancelEdit}
            className="px-3 py-1.5 text-sm text-muted hover:text-txt transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveEdit}
            disabled={!form.name.trim()}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-txt mb-1">Agents</h2>
          <p className="text-sm text-muted">AI agent profiles with assigned skills.</p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-3 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Agent
        </button>
      </div>

      <div className="space-y-3">
        {agents.map(agent => (
          <div key={agent.id}>
            {editing === agent.id && editForm ? (
              renderForm(editForm)
            ) : (
              <div className={cn(
                "flex items-start gap-3 p-4 border rounded-lg transition-colors group",
                agent.active ? "border-border hover:border-accent/30" : "border-border/50 opacity-60"
              )}>
                <div className="w-10 h-10 rounded-lg bg-surface2 flex items-center justify-center text-xl shrink-0">
                  {agent.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-txt">{agent.name}</span>
                    {!agent.active && (
                      <span className="text-xs bg-surface2 px-1.5 py-0.5 rounded text-muted">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted mt-0.5">{agent.description}</p>
                  {agent.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {agent.skills.map(skillId => {
                        const skill = skills.find(s => s.id === skillId)
                        return skill ? (
                          <span key={skillId} className="flex items-center gap-1 text-xs bg-surface2 px-1.5 py-0.5 rounded text-muted">
                            {skill.icon} {skill.name}
                          </span>
                        ) : null
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(agent.id)}
                    className={cn(
                      "w-9 h-5 rounded-full transition-colors relative",
                      agent.active ? "bg-accent" : "bg-border"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                        agent.active ? "left-4" : "left-0.5"
                      )}
                    />
                  </button>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(agent)}
                      className="p-1.5 rounded hover:bg-surface2 text-muted hover:text-txt transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteAgent(agent.id)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {isNew && editForm && renderForm(editForm)}

        {agents.length === 0 && !isNew && (
          <div className="text-center py-8 text-muted">
            <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No agents configured</p>
            <p className="text-xs mt-1">Add an agent to define AI personas with skills</p>
          </div>
        )}
      </div>
    </div>
  )
}
