import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppState } from '@shared/types'
import { DEFAULT_MODEL, WORKER_MODEL } from '@shared/providers'
import { BUILT_IN_AGENTS } from './agents/defaults'

const emptyState = (): AppState => ({
  profile: { name: '', role: '', venture: '', mission: '', operatingStyle: '' },
  objectives: [],
  tasks: [],
  decisions: [],
  memories: [],
  briefings: [],
  attention: [],
  brain: [],
  meetings: [],
  conversations: [],
  agents: BUILT_IN_AGENTS(),
  runs: [],
  workflows: [],
  workflowRuns: [],
  connections: [],
  settings: {
    model: DEFAULT_MODEL,
    effort: 'high',
    showThinking: true,
    theme: 'dark',
    automationsEnabled: true,
    attentionEnabled: true,
    menuBarEnabled: true,
    boardroomModel: WORKER_MODEL,
    voiceEnabled: false,
    personaVoices: {}
  }
})

/**
 * The single source of truth, persisted as one JSON document. Writes are
 * atomic (temp file + rename) so a crash mid-write can never leave a
 * half-written state on disk.
 */
class Store {
  private state: AppState = emptyState()
  private file = ''
  private writeQueued = false

  init(): void {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'stobs.json')
    this.state = this.load()
  }

  private load(): AppState {
    const base = emptyState()
    if (!existsSync(this.file)) return base

    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<AppState>
      const merged: AppState = {
        ...base,
        ...parsed,
        profile: { ...base.profile, ...parsed.profile },
        settings: { ...base.settings, ...parsed.settings }
      }

      // Built-in agents ship with the app, so re-seed any the user has not
      // customised rather than leaving an older install without them.
      const known = new Set(merged.agents.map((agent) => agent.id))
      for (const builtIn of BUILT_IN_AGENTS()) {
        if (!known.has(builtIn.id)) merged.agents.push(builtIn)
      }
      return merged
    } catch {
      try {
        renameSync(this.file, `${this.file}.corrupt-${Date.now()}`)
      } catch {
        /* best effort — never lose the user's data silently */
      }
      return base
    }
  }

  get(): AppState {
    return this.state
  }

  update(mutate: (state: AppState) => void): AppState {
    mutate(this.state)
    this.scheduleFlush()
    return this.state
  }

  private scheduleFlush(): void {
    if (this.writeQueued) return
    this.writeQueued = true
    setTimeout(() => {
      this.writeQueued = false
      this.flush()
    }, 150)
  }

  flush(): void {
    if (!this.file) return
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8')
    renameSync(tmp, this.file)
  }
}

export const store = new Store()
export const id = (): string => randomUUID()
export const now = (): string => new Date().toISOString()

/** Local calendar date — a briefing belongs to the user's day, not UTC's. */
export const today = (): string => {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
