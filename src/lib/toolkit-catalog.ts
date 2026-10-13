/**
 * src/lib/toolkit-catalog.ts (R098)
 * The vetted Claude Code plugins onboarding offers. Pure data: ranked for a project by rankToolkit (toolkit.ts).
 * Ids and marketplaces checked against Claude Code 2.1.296 (`claude plugin marketplace list --json` and each
 * marketplace's .claude-plugin/marketplace.json), 2026-10-13; every item installed for real with that version into a
 * scratch CLAUDE_CONFIG_DIR (T527).
 */
import type { ToolkitItem } from './toolkit'

const OFFICIAL = { name: 'claude-plugins-official', repo: 'anthropics/claude-plugins-official' }
const ANTHROPIC_SKILLS = { name: 'anthropic-agent-skills', repo: 'anthropics/skills' }

export const TOOLKIT_CATALOG: ToolkitItem[] = [
  {
    id: 'frontend-design', title: 'Frontend design', plugin: 'frontend-design', marketplace: OFFICIAL, fit: ['web-frontend'], order: 10,
    reason: { en: 'UI work that avoids the generic "AI look"', vi: 'Làm giao diện không mang "vẻ AI" rập khuôn' },
  },
  {
    id: 'example-skills', title: 'Anthropic example skills', plugin: 'example-skills', marketplace: ANTHROPIC_SKILLS, fit: ['web-frontend'], order: 20,
    reason: {
      en: 'Includes webapp-testing: the agent checks your running web app in a real browser',
      vi: 'Có webapp-testing: agent kiểm tra web app đang chạy trong trình duyệt thật',
    },
  },
  {
    id: 'code-review', title: 'Code review', plugin: 'code-review', marketplace: OFFICIAL, fit: ['git'], order: 30,
    reason: { en: '/code-review: parallel reviewers, only confident findings', vi: '/code-review: nhiều reviewer song song, chỉ báo lỗi chắc chắn' },
  },
  {
    id: 'commit-commands', title: 'Commit commands', plugin: 'commit-commands', marketplace: OFFICIAL, fit: ['git'], order: 40,
    reason: { en: '/commit, /commit-push-pr and branch cleanup', vi: '/commit, /commit-push-pr và dọn nhánh' },
  },
  {
    id: 'security-guidance', title: 'Security guidance', plugin: 'security-guidance', marketplace: OFFICIAL, fit: ['server'], order: 50,
    reason: { en: 'Warns about risky edits (injection, eval, secrets) as they happen', vi: 'Cảnh báo ngay khi sửa code rủi ro (injection, eval, secret)' },
  },
  {
    id: 'typescript-lsp', title: 'TypeScript LSP', plugin: 'typescript-lsp', marketplace: OFFICIAL, fit: ['lsp-ts'], order: 60,
    reason: { en: 'Real go-to-definition and diagnostics for the agent', vi: 'Agent có go-to-definition và báo lỗi thật' },
  },
  {
    id: 'pyright-lsp', title: 'Python LSP (Pyright)', plugin: 'pyright-lsp', marketplace: OFFICIAL, fit: ['lsp-py'], order: 60,
    reason: { en: 'Real go-to-definition and diagnostics for the agent', vi: 'Agent có go-to-definition và báo lỗi thật' },
  },
  {
    id: 'gopls-lsp', title: 'Go LSP (gopls)', plugin: 'gopls-lsp', marketplace: OFFICIAL, fit: ['lsp-go'], order: 60,
    reason: { en: 'Real go-to-definition and diagnostics for the agent', vi: 'Agent có go-to-definition và báo lỗi thật' },
  },
  {
    id: 'feature-dev', title: 'Feature dev', plugin: 'feature-dev', marketplace: OFFICIAL, fit: [], order: 70,
    reason: { en: 'Guided explore → design → build → review workflow', vi: 'Quy trình có hướng dẫn: tìm hiểu → thiết kế → làm → review' },
  },
  {
    id: 'superpowers', title: 'Superpowers', plugin: 'superpowers', marketplace: OFFICIAL, fit: [], order: 80,
    reason: { en: 'Skills for TDD, systematic debugging and verify-before-done', vi: 'Skill cho TDD, debug có hệ thống và kiểm tra trước khi xong' },
  },
]
