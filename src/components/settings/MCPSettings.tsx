"use client"

import { useState } from "react"
import { Plug, Check, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { resolveMcpEndpoint, type AppSettings } from "@/lib/settings"
import { useOrigin } from "@/hooks/use-origin"
import { useT } from "@/context/LanguageContext"
import { ConnectAgentPanel } from "@/components/connect/ConnectAgentPanel"

interface MCPSettingsProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
}

export function MCPSettings({ settings, onSave }: MCPSettingsProps) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null)
  const { t } = useT()
  const endpoint = resolveMcpEndpoint(settings.mcp.endpoint, useOrigin())

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
      const res = await fetch(endpoint, {
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

  return (
    <div className="space-y-8">
      <ConnectAgentPanel mcpUrl={endpoint} />

      <div>
        <h3 className="text-sm font-semibold text-txt mb-1">{t("connect.advanced")}</h3>
        <p className="text-sm text-muted">{t("settings.mcpHint")}</p>
      </div>

      {/* Endpoint */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-txt">{t("settings.mcpEndpoint")}</label>
        <div className="flex gap-2">
          <Input
            value={endpoint}
            onChange={(e) => updateMcp("endpoint", e.target.value)}
            className="bg-surface2 font-mono text-sm"
          />
          <button
            onClick={testConnection}
            disabled={testing}
            className="px-4 py-2 bg-accent text-accent-fg rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plug className="w-4 h-4" />
            )}
            {t("settings.test")}
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
                {t("settings.connOk")}
              </>
            ) : (
              <>
                <X className="w-4 h-4" />
                {t("settings.connFailed")}
              </>
            )}
          </div>
        )}
      </div>

    </div>
  )
}
