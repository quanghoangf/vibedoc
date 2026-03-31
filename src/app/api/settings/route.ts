import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { getConfiguredRoot } from '@/lib/core'
import { DEFAULT_SETTINGS, DEFAULT_SKILLS, DEFAULT_AGENTS, type AppSettings, type Skill, type Agent } from '@/lib/settings'

const VIBEDOC_DIR = '.vibedoc'
const SETTINGS_FILE = 'settings.json'
const SKILLS_FILE = 'skills.json'
const AGENTS_FILE = 'agents.json'

async function ensureVibedocDir(root: string) {
  const dir = path.join(root, VIBEDOC_DIR)
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch {}
  return dir
}

async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return { ...defaultValue, ...JSON.parse(content) }
  } catch {
    return defaultValue
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

export async function GET(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const type = req.nextUrl.searchParams.get('type') || 'all'
  const dir = await ensureVibedocDir(root)

  try {
    if (type === 'settings' || type === 'all') {
      const settings = await readJsonFile<AppSettings>(path.join(dir, SETTINGS_FILE), DEFAULT_SETTINGS)
      if (type === 'settings') return NextResponse.json(settings)
    }

    if (type === 'skills' || type === 'all') {
      const skills = await readJsonFile<{ skills: Skill[] }>(path.join(dir, SKILLS_FILE), { skills: DEFAULT_SKILLS })
      if (type === 'skills') return NextResponse.json(skills)
    }

    if (type === 'agents' || type === 'all') {
      const agents = await readJsonFile<{ agents: Agent[] }>(path.join(dir, AGENTS_FILE), { agents: DEFAULT_AGENTS })
      if (type === 'agents') return NextResponse.json(agents)
    }

    // Return all
    const [settings, skillsData, agentsData] = await Promise.all([
      readJsonFile<AppSettings>(path.join(dir, SETTINGS_FILE), DEFAULT_SETTINGS),
      readJsonFile<{ skills: Skill[] }>(path.join(dir, SKILLS_FILE), { skills: DEFAULT_SKILLS }),
      readJsonFile<{ agents: Agent[] }>(path.join(dir, AGENTS_FILE), { agents: DEFAULT_AGENTS }),
    ])

    return NextResponse.json({
      settings,
      skills: skillsData.skills,
      agents: agentsData.agents,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const root = req.nextUrl.searchParams.get('root') || getConfiguredRoot()
  const type = req.nextUrl.searchParams.get('type')
  const dir = await ensureVibedocDir(root)

  try {
    const data = await req.json()

    switch (type) {
      case 'settings':
        await writeJsonFile(path.join(dir, SETTINGS_FILE), data)
        break
      case 'skills':
        await writeJsonFile(path.join(dir, SKILLS_FILE), { skills: data })
        break
      case 'agents':
        await writeJsonFile(path.join(dir, AGENTS_FILE), { agents: data })
        break
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
