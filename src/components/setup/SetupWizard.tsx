"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/context/AppContext"
import { ChevronLeft, ChevronRight, Sparkles, FileText, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { TemplateSelector, type TemplateSelection } from "./TemplateSelector"
import { type ProjectAnswers } from "./ProjectQuestionnaire"
import { BasicInfo } from "./BasicInfo"
import { TechStackInput } from "./TechStackInput"
import { TeamConventions } from "./TeamConventions"
import { GenerationPreview, type GeneratedFile } from "./GenerationPreview"

const STEPS = [
  { id: "welcome",   title: "Welcome" },
  { id: "templates", title: "Templates" },
  { id: "basic-info", title: "Basic Info" },
  { id: "tech-stack", title: "Tech Stack" },
  { id: "team",      title: "Team" },
  { id: "mode",      title: "Generation" },
  { id: "preview",   title: "Preview" },
  { id: "complete",  title: "Complete" },
]

const LAST_STEP = STEPS.length - 1
const GENERATE_STEP = 5 // "mode" step — clicking Next triggers generation
const PREVIEW_STEP = 6
const WRITE_STEP = 7

export function SetupWizard() {
  const { activeProject, rootParam, projects } = useApp()
  const currentProject = projects.find(p => p.root === activeProject)
  const [step, setStep] = useState(0)
  const [selectedTemplates, setSelectedTemplates] = useState<TemplateSelection[]>([])
  const [answers, setAnswers] = useState<ProjectAnswers>({
    projectName: "",
    projectType: "web-app",
    description: "",
    repoUrl: "",
    techStackTags: [],
    keyFeatures: "",
    teamSize: "",
    linting: [],
    testFramework: "",
    ciCd: [],
    branchStrategy: "",
    deploymentTarget: [],
    conventions: "",
  })
  const [mode, setMode] = useState<"quick" | "ai">("quick")
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [existingFiles, setExistingFiles] = useState<string[]>([])

  useEffect(() => {
    async function checkExisting() {
      try {
        const res = await fetch(`/api/docs${rootParam}`)
        const docs = await res.json()
        const existing = docs.filter((d: { path: string }) =>
          d.path === "CLAUDE.md" || d.path === "AGENTS.md"
        ).map((d: { path: string }) => d.path)
        setExistingFiles(existing)
      } catch {}
    }
    checkExisting()
  }, [rootParam])

  const canProceed = () => {
    switch (step) {
      case 0: return true
      case 1: return selectedTemplates.length > 0
      case 2: return answers.projectName.trim() !== ""
      default: return true
    }
  }

  const handleNext = async () => {
    if (step === GENERATE_STEP) {
      setIsGenerating(true)
      try {
        const res = await fetch(`/api/setup/generate${rootParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templates: selectedTemplates, answers, mode }),
        })
        const data = await res.json()
        setGeneratedFiles(data.files || [])
      } catch {
        setGeneratedFiles([])
      }
      setIsGenerating(false)
    }
    setStep(s => Math.min(s + 1, LAST_STEP))
  }

  const handleBack = () => {
    setStep(s => Math.max(s - 1, 0))
  }

  const handleWrite = async () => {
    setIsGenerating(true)
    try {
      await fetch(`/api/setup/write${rootParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: generatedFiles }),
      })
      setStep(WRITE_STEP)
    } catch {}
    setIsGenerating(false)
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Progress bar */}
      <div className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-semibold text-txt">Setup Wizard</h1>
            <span className="text-sm text-muted">Step {step + 1} of {STEPS.length}</span>
          </div>
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i <= step ? "bg-accent" : "bg-border"
                )}
              />
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex-1 text-center">
                {i === step && (
                  <span className="text-xs text-accent">{s.title}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
                  <Sparkles className="w-8 h-8 text-accent" />
                </div>
                <h2 className="text-2xl font-bold text-txt">Welcome to VibeDoc</h2>
                <p className="text-muted max-w-md mx-auto">
                  Let&apos;s set up your project documentation. You can generate AI-optimized
                  docs like CLAUDE.md, architecture overviews, and more.
                </p>
              </div>

              {currentProject && (
                <div className="bg-surface border border-border rounded-lg p-4">
                  <div className="text-sm text-muted mb-1">Current Project</div>
                  <div className="font-medium text-txt">{currentProject.name}</div>
                  <div className="text-xs text-muted mt-1 font-mono">{currentProject.root}</div>
                </div>
              )}

              {existingFiles.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <div className="text-sm font-medium text-amber-400 mb-1">Existing files detected</div>
                  <div className="text-sm text-amber-400/80">
                    {existingFiles.join(", ")} already exist. They will be skipped during generation.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Template Selection */}
          {step === 1 && (
            <TemplateSelector
              selected={selectedTemplates}
              onChange={setSelectedTemplates}
            />
          )}

          {/* Step 2: Basic Info */}
          {step === 2 && (
            <BasicInfo
              answers={answers}
              onChange={setAnswers}
            />
          )}

          {/* Step 3: Tech Stack */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-txt mb-2">Tech Stack</h2>
                <p className="text-muted">Add the technologies your project uses. Search or type custom ones.</p>
              </div>
              <TechStackInput
                value={answers.techStackTags}
                onChange={(tags) => setAnswers(a => ({ ...a, techStackTags: tags }))}
              />
              {answers.techStackTags.length > 0 && (
                <p className="text-sm text-muted">{answers.techStackTags.length} technology{answers.techStackTags.length !== 1 ? "ies" : "y"} added</p>
              )}
            </div>
          )}

          {/* Step 4: Team & Conventions */}
          {step === 4 && (
            <TeamConventions
              answers={answers}
              onChange={setAnswers}
            />
          )}

          {/* Step 5: Generation Mode */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-txt mb-2">Choose Generation Mode</h2>
                <p className="text-muted">How would you like to generate your documentation?</p>
              </div>

              <div className="grid gap-4">
                <button
                  onClick={() => setMode("quick")}
                  className={cn(
                    "p-4 rounded-lg border text-left transition-all",
                    mode === "quick"
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-accent/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-accent mt-0.5" />
                    <div>
                      <div className="font-medium text-txt">Quick Mode</div>
                      <div className="text-sm text-muted mt-1">
                        Use templates with your project info filled in. Fast and reliable.
                      </div>
                    </div>
                    {mode === "quick" && (
                      <Check className="w-5 h-5 text-accent ml-auto" />
                    )}
                  </div>
                </button>

                <button
                  onClick={() => setMode("ai")}
                  className={cn(
                    "p-4 rounded-lg border text-left transition-all",
                    mode === "ai"
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-accent/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-accent mt-0.5" />
                    <div>
                      <div className="font-medium text-txt">AI Mode</div>
                      <div className="text-sm text-muted mt-1">
                        Generate custom content using your connected coding agent (Claude Code, Cursor, etc.).
                      </div>
                      <div className="text-xs text-accent mt-2">
                        Requires MCP connection
                      </div>
                    </div>
                    {mode === "ai" && (
                      <Check className="w-5 h-5 text-accent ml-auto" />
                    )}
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Preview */}
          {step === 6 && (
            <GenerationPreview
              files={generatedFiles}
              onWrite={handleWrite}
              isWriting={isGenerating}
            />
          )}

          {/* Step 7: Complete */}
          {step === 7 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-txt">Setup Complete!</h2>
              <p className="text-muted max-w-md mx-auto">
                Your documentation files have been created. You can now view and edit them in the Docs tab.
              </p>

              <div className="bg-surface border border-border rounded-lg p-4 text-left max-w-md mx-auto">
                <div className="text-sm font-medium text-txt mb-2">Next steps:</div>
                <ul className="text-sm text-muted space-y-2">
                  <li>• Review generated files in the Docs tab</li>
                  <li>• Edit content to match your project specifics</li>
                  <li>• Connect your coding agent via MCP for AI assistance</li>
                </ul>
              </div>

              <a
                href="/docs"
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 transition-colors"
              >
                Go to Docs
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      {step < LAST_STEP && (
        <div className="border-t border-border bg-surface">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={step === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
                step === 0
                  ? "text-muted cursor-not-allowed"
                  : "text-txt hover:bg-surface2"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {step === PREVIEW_STEP ? (
              <button
                onClick={handleWrite}
                disabled={isGenerating || generatedFiles.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Writing...
                  </>
                ) : (
                  <>
                    Write Files
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canProceed() || isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    {step === GENERATE_STEP ? "Generate" : "Next"}
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
