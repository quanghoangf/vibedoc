"use client"

export interface ProjectAnswers {
  projectName: string
  projectType: string
  description: string
  repoUrl: string
  techStackTags: string[]
  keyFeatures: string
  // Team & conventions
  teamSize: string
  linting: string[]
  testFramework: string
  ciCd: string[]
  branchStrategy: string
  deploymentTarget: string[]
  conventions: string
}
