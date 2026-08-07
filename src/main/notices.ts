import type { AppState, Notice, NoticeKind, Run, WorkflowRun } from '@shared/types'
import { id, now, store } from './store'

/**
 * The notification centre.
 *
 * Grove does most of its work while you are looking at something else — an
 * agent finishes a run, an automation fires at seven in the morning, a token
 * expires overnight. A macOS banner shows that once and is gone; this is the
 * record you can come back to.
 *
 * Everything here is derived from work that actually happened. Nothing is
 * generated to fill the list.
 */

const LIMIT = 60

export const push = (
  kind: NoticeKind,
  title: string,
  body: string,
  view: string | null = null
): Notice => {
  const notice: Notice = { id: id(), kind, title, body, view, read: false, at: now() }
  store.update((draft) => {
    draft.notices.unshift(notice)
    if (draft.notices.length > LIMIT) draft.notices.length = LIMIT
  })
  return notice
}

/** Records a run reaching a state worth interrupting someone about. */
export const noticeForRun = (run: Run): void => {
  // Chat replies and handoffs are already on screen; announcing them twice is
  // noise, which is how a notification centre becomes something people ignore.
  if (run.trigger === 'chat' || run.trigger === 'handoff') return

  if (run.status === 'awaiting_approval' && run.pending) {
    push(
      'approval',
      `${run.agentName} needs approval`,
      run.pending.summary.split('\n')[0] ?? run.pending.toolName,
      'agents'
    )
  } else if (run.status === 'succeeded') {
    push('run', `${run.agentName} finished`, run.output.slice(0, 200) || 'Done.', 'agents')
  } else if (run.status === 'failed') {
    push('error', `${run.agentName} failed`, run.error ?? 'Something went wrong.', 'agents')
  }
}

export const noticeForWorkflow = (workflowRun: WorkflowRun): void => {
  if (workflowRun.status === 'succeeded') {
    push('automation', `${workflowRun.workflowName} ran`, `${workflowRun.runIds.length} steps.`, 'automations')
  } else if (workflowRun.status === 'failed') {
    push('error', `${workflowRun.workflowName} failed`, workflowRun.error ?? 'Something went wrong.', 'automations')
  }
}

export const markAllRead = (): AppState =>
  store.update((draft) => {
    for (const notice of draft.notices) notice.read = true
  })

export const clearNotices = (): AppState =>
  store.update((draft) => {
    draft.notices = []
  })

export const unreadCount = (): number => store.get().notices.filter((entry) => !entry.read).length
