"use client"

import { useState } from "react"
import { Plug, Check, X, Copy, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import type { AppSettings } from "@/lib/settings"

interface MCPSettingsProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

const AGENT_CONFIGS = {
  "claude-code": {
    name: "Claude Code",
    config: `{
  "mcpServers": {
    "vibedoc": {
      "url": "{{ENDPOINT}}"
    }
  }
}`,
    path: "~/.claude/claude.json",
  },
  cursor: {
    name: "Cursor",
    config: `{
  "mcp": {
    "servers": {
      "vibedoc": {
        "url": "{{ENDPOINT}}"
      }
    }
  }
}`,
    path: ".cursor/mcp.json",
  },
  windsurf: {
    name: "Windsurf",
    config: `{
  "mcpServers": {
    "vibedoc": {
      "url": "{{ENDPOINT}}"
    }
  }
}`,
    path: ".windsurf/mcp.json",
  },
}

export function MCPSettings({ settings, onSave }: MCPSettingsProps) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const updateMcp = (key: keyof AppSettings["mcp"], value: string) => {
    onSave({
      ...settings,
      mcp: { ...settings.mcp, [key]: value },
    })
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(settings.mcp.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        }),
      })
      if (res.ok) {
        setTestResult("success")
      } else {
        setTestResult("error")
      }
    } catch {
      setTestResult("error")
    }
    setTesting(false)
  }

  const copyConfig = async (agentId: string) => {
    const agent = AGENT_CONFIGS[agentId as keyof typeof AGENT_CONFIGS]
    const config = agent.config.replace("{{ENDPOINT}}", settings.mcp.endpoint)
    await navigator.clipboard.writeText(config)
    setCopied(agentId)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-txt mb-1">MCP Connection</h2>
        <p className="text-sm text-muted">Configure the Model Context Protocol server for AI agents.</p>
      </div>

      {/* Endpoint */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-txt">MCP Endpoint</label>
        <div className="flex gap-2">
          <Input
            value={settings.mcp.endpoint}
            onChange={(e) => updateMcp("endpoint", e.target.value)}
            className="bg-surface2 font-mono text-sm"
          />
          <button
            onClick={testConnection}
            disabled={testing}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plug className="w-4 h-4" />
            )}
            Test
          </button>
        </div>
        {testResult && (
          <div className={cn(
            "flex items-center gap-2 text-sm",
            testResult === "success" ? "text-green-400" : "text-red-400"
          )}>
            {testResult === "success" ? (
              <>
                <Check className="w-4 h-4" />
                Connection successful
              </>
            ) : (
              <>
                <X className="w-4 h-4" />
                Connection failed
              </>
            )}
          </div>
        )}
      </div>

      {/* Agent Configs */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-txt">Agent Configuration</label>
        <p className="text-xs text-muted">Copy the configuration for your coding agent:</p>
        <div className="space-y-2">
          {Object.entries(AGENT_CONFIGS).map(([id, agent]) => (
            <div
              key={id}
              className="flex items-center justify-between p-3 border border-border rounded-lg"
            >
              <div>
                <div className="text-sm font-medium text-txt">{agent.name}</div>
                <div className="text-xs text-muted font-mono">{agent.path}</div>
              </div>
              <button
                onClick={() => copyConfig(id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                  copied === id
                    ? "bg-green-500/20 text-green-400"
                    : "bg-surface2 text-muted hover:text-txt"
                )}
              >
                {copied === id ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
