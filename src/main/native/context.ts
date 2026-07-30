import { exec } from 'node:child_process'
import { osa } from './osa'
import { store, today } from '../store'

/**
 * Active-context sampling.
 *
 * Grove records which application is frontmost and for how long — never a
 * screenshot, never window contents beyond the title the app already puts in
 * its own title bar. That is enough to tell the principal where their hours
 * actually went, which is the one thing a calendar cannot.
 */

const SAMPLE_SECONDS = 20
/** Anything past this and the machine is idle, not working. */
const IDLE_CUTOFF_SECONDS = 150

let timer: NodeJS.Timeout | null = null
let lastError: string | null = null

export interface ActiveContext {
  app: string
  title: string
}

const idleSeconds = (): Promise<number> =>
  new Promise((resolve) => {
    exec(
      "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print int($NF/1000000000); exit}'",
      { timeout: 4000 },
      (error, stdout) => resolve(error ? 0 : Number(stdout.trim()) || 0)
    )
  })

export const activeContext = async (): Promise<ActiveContext | null> => {
  try {
    const result = await osa<ActiveContext>(
      `
      const se = Application('System Events')
      const proc = se.applicationProcesses.whose({ frontmost: true })()[0]
      let title = ''
      try { title = String(proc.windows[0].name()) } catch (e) { title = '' }
      JSON.stringify({ app: String(proc.name()), title: title })
    `,
      6000
    )
    lastError = null
    return result ?? null
  } catch (error) {
    lastError = (error as Error).message
    return null
  }
}

const record = (app: string, seconds: number): void => {
  store.update((state) => {
    const date = today()
    let day = state.attention.find((entry) => entry.date === date)
    if (!day) {
      day = { date, apps: [] }
      state.attention.push(day)
      // Roughly a month of history is plenty and keeps the file small.
      if (state.attention.length > 45) state.attention.shift()
    }
    const bucket = day.apps.find((entry) => entry.name === app)
    if (bucket) bucket.seconds += seconds
    else day.apps.push({ name: app, seconds })
  })
}

const tick = async (): Promise<void> => {
  if (!store.get().settings.attentionEnabled) return
  if ((await idleSeconds()) > IDLE_CUTOFF_SECONDS) return
  const context = await activeContext()
  if (context?.app) record(context.app, SAMPLE_SECONDS)
}

export const startAttention = (): void => {
  if (timer) return
  timer = setInterval(() => void tick(), SAMPLE_SECONDS * 1000)
}

export const stopAttention = (): void => {
  if (timer) clearInterval(timer)
  timer = null
}

export const attentionError = (): string | null => lastError

const humanise = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

/** Rolls the ledger into something an agent can reason about. */
export const attentionReport = async (input: Record<string, any>): Promise<string> => {
  const days = Math.min(Number(input.days) || 1, 30)
  const state = store.get()
  if (!state.settings.attentionEnabled) {
    return 'Attention tracking is switched off, so there is no record of where time went.'
  }

  const cutoff = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10)
  const relevant = state.attention.filter((entry) => entry.date >= cutoff)
  if (relevant.length === 0) return 'No attention recorded yet for that window.'

  const totals = new Map<string, number>()
  for (const day of relevant) {
    for (const app of day.apps) totals.set(app.name, (totals.get(app.name) ?? 0) + app.seconds)
  }

  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1])
  const total = ranked.reduce((sum, [, seconds]) => sum + seconds, 0)

  return [
    `Attention over the last ${days} day(s) — ${humanise(total)} of active machine time:`,
    ...ranked
      .slice(0, 15)
      .map(
        ([name, seconds]) =>
          `  • ${name}: ${humanise(seconds)} (${Math.round((seconds / total) * 100)}%)`
      ),
    '',
    'This is frontmost-application time on this Mac. It excludes idle periods and anything done away from the machine.'
  ].join('\n')
}

/** What the principal is doing right now, for briefings and the menu bar. */
export const currentFocus = async (): Promise<string> => {
  const context = await activeContext()
  if (!context) return 'Unknown'
  return context.title ? `${context.app} — ${context.title}` : context.app
}
