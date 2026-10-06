"use client"

import { useMemo } from "react"
import { useT } from "@/context/LanguageContext"

/** React Flow's own control and node labels in the UI language (its ariaLabelConfig); `nodeHint` replaces the default. */
export function useFlowAriaLabels(nodeHint?: string) {
  const { t } = useT()
  return useMemo(() => ({
    "controls.ariaLabel": t("shell.flowControls"),
    "controls.zoomIn.ariaLabel": t("shell.zoomIn"),
    "controls.zoomOut.ariaLabel": t("shell.zoomOut"),
    "controls.fitView.ariaLabel": t("shell.fitView"),
    "node.a11yDescription.default": nodeHint ?? t("shell.flowNodeHint"),
  }), [t, nodeHint])
}
