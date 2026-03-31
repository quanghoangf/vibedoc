"use client";

import { useState } from "react";
import { FileText, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/docs/MarkdownRenderer";

export interface GeneratedFile {
  path: string;
  content: string;
  skipped?: boolean;
  reason?: string;
}

interface GenerationPreviewProps {
  files: GeneratedFile[];
  onWrite: () => void;
  isWriting: boolean;
  mode: "quick" | "ai";
  onModeChange: (mode: "quick" | "ai") => void;
}

export function GenerationPreview({
  files,
  onWrite,
  isWriting,
  mode,
  onModeChange,
}: GenerationPreviewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toWrite = files.filter((f) => !f.skipped);
  const skipped = files.filter((f) => f.skipped);

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-muted mx-auto mb-4" />
        <h3 className="text-lg font-medium text-txt mb-2">
          No files generated
        </h3>
        <p className="text-muted">
          Something went wrong. Please go back and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-txt mb-2">Preview</h2>
          <p className="text-muted">Review the files that will be created.</p>
        </div>
        <div className="flex items-center gap-1 bg-surface2 rounded-lg p-1">
          <button
            onClick={() => onModeChange("quick")}
            className={cn(
              "px-3 py-1 text-sm rounded-md transition-colors",
              mode === "quick"
                ? "bg-surface text-txt shadow-sm"
                : "text-muted hover:text-txt",
            )}
          >
            Quick
          </button>
          <button
            onClick={() => onModeChange("ai")}
            className={cn(
              "px-3 py-1 text-sm rounded-md transition-colors",
              mode === "ai"
                ? "bg-surface text-txt shadow-sm"
                : "text-muted hover:text-txt",
            )}
          >
            AI
          </button>
        </div>
      </div>

      {/* Files to write */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
          Files to create ({toWrite.length})
        </h3>
        <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
          {toWrite.map((file) => {
            const isExpanded = expanded.has(file.path);
            const isMd = file.path.endsWith(".md");
            return (
              <div key={file.path}>
                <button
                  onClick={() => toggleExpand(file.path)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-surface2 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                  )}
                  <FileText className="w-4 h-4 text-accent shrink-0" />
                  <span className="text-sm font-mono text-txt">
                    {file.path}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3">
                    {isMd ? (
                      <div className="prose prose-invert max-w-none p-3 bg-surface2 rounded-lg max-h-64 overflow-y-auto text-sm">
                        <MarkdownRenderer
                          content={file.content.slice(0, 3000)}
                        />
                      </div>
                    ) : (
                      <pre className="p-3 bg-surface2 rounded-lg text-xs text-muted overflow-x-auto max-h-64 overflow-y-auto">
                        {file.content.slice(0, 2000)}
                        {file.content.length > 2000 && "\n\n...(truncated)"}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Skipped files */}
      {skipped.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted uppercase tracking-wider">
            Skipped ({skipped.length})
          </h3>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-1">
            {skipped.map((file) => (
              <div key={file.path} className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-mono text-amber-400">{file.path}</span>
                <span className="text-amber-400/70">
                  — {file.reason || "already exists"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-sm text-muted">
        {toWrite.length} file{toWrite.length !== 1 ? "s" : ""} will be created
        {skipped.length > 0 && `, ${skipped.length} skipped`}
      </div>
    </div>
  );
}
