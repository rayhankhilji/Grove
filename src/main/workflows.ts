import type { WorkflowRun } from '@shared/types'
import { startRun } from './agents/runtime'
import { id, now, store } from './store'

type Listener = () => void
const listeners = new Set<Listener>()

export const onWorkflowUpdate = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const publish = (): void => {
  for (const listener of listeners) listener()
}

/**
 * Runs a workflow's steps in order. Each step is a real agent run, so it shows
 * up in the Runs view and can be inspected exactly like a manual one.
 */
export const runWorkflow = async (
  workflowId: string,
  trigger: 'manual' | 'schedule'
): Promise<WorkflowRun | null> => {
  const state = store.get()
  const workflow = state.workflows.find((entry) => entry.id === workflowId)
  if (!workflow || workflow.steps.length === 0) return null

  const workflowRun: WorkflowRun = {
    id: id(),
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: 'running',
    runIds: [],
    startedAt: now(),
    endedAt: null,
    error: null
  }

  store.update((draft) => {
    draft.workflowRuns.unshift(workflowRun)
    if (draft.workflowRuns.length > 100) draft.workflowRuns.length = 100
    const target = draft.workflows.find((entry) => entry.id === workflowId)
    if (target) target.lastRunAt = now()
  })
  publish()

  let previous = ''

  try {
    for (const step of workflow.steps) {
      const agent = store.get().agents.find((candidate) => candidate.id === step.agentId)
      if (!agent) throw new Error('A step points at an agent that no longer exists.')

      const input =
        step.usePrevious && previous
          ? `${step.instruction}\n\nContext from the previous step:\n\n${previous}`
          : step.instruction

      const run = await startRun({
        agent,
        input,
        trigger: trigger === 'schedule' ? 'schedule' : 'workflow',
        triggeredBy: workflow.name,
        workflowRunId: workflowRun.id
      })

      store.update(() => {
        workflowRun.runIds.push(run.id)
      })
      publish()

      if (run.status === 'failed') throw new Error(run.error ?? 'A step failed.')
      previous = run.output
    }

    store.update(() => {
      workflowRun.status = 'succeeded'
      workflowRun.endedAt = now()
    })
  } catch (error) {
    store.update(() => {
      workflowRun.status = 'failed'
      workflowRun.error = (error as Error).message
      workflowRun.endedAt = now()
    })
  }

  publish()
  return workflowRun
}

/* ── Scheduler ───────────────────────────────────────────────────────────── */

let timer: NodeJS.Timeout | null = null
/** Fired slots, keyed `workflowId@YYYY-MM-DDTHH:MM`, so a tick can't double-fire. */
const fired = new Set<string>()

const slotKey = (workflowId: string, at: Date): string =>
  `${workflowId}@${at.toISOString().slice(0, 16)}`

const tick = (): void => {
  const state = store.get()
  if (!state.settings.automationsEnabled) return

  const at = new Date()
  for (const workflow of state.workflows) {
    if (!workflow.enabled || workflow.trigger !== 'schedule') continue

    const { hour, minute, days } = workflow.schedule
    if (at.getHours() !== hour || at.getMinutes() !== minute) continue
    if (days.length > 0 && !days.includes(at.getDay())) continue

    const key = slotKey(workflow.id, at)
    if (fired.has(key)) continue
    fired.add(key)
    // Keep the guard set from growing without bound across long uptimes.
    if (fired.size > 500) fired.clear()

    void runWorkflow(workflow.id, 'schedule')
  }
}

export const startScheduler = (): void => {
  if (timer) return
  // Every 20s, so a minute-precision schedule cannot be missed.
  timer = setInterval(tick, 20_000)
}

export const stopScheduler = (): void => {
  if (timer) clearInterval(timer)
  timer = null
}

/** Next fire time for a schedule, used to show "next run" in the UI. */
export const nextRun = (hour: number, minute: number, days: number[]): Date => {
  const at = new Date()
  at.setSeconds(0, 0)
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(at)
    candidate.setDate(at.getDate() + offset)
    candidate.setHours(hour, minute, 0, 0)
    if (candidate <= new Date()) continue
    if (days.length > 0 && !days.includes(candidate.getDay())) continue
    return candidate
  }
  return at
}
