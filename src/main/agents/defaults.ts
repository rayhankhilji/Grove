import type { Agent } from '@shared/types'
import { DEFAULT_MODEL } from '@shared/models'

/**
 * Capabilities every agent has, always.
 *
 * These are not preferences — they are what makes an agent an agent in Grove:
 * it can read the workspace, remember, ask for an app it needs, and build a
 * teammate. They are unioned into every agent on load, so shipping a new one
 * reaches agents the user has already customised. Anything gated behind
 * "untouched" silently strands the agent people actually use.
 */
export const CORE_GRANTS = [
  'review',
  'remember',
  'brain_search',
  'create_agent',
  'request_connection'
]

export const WORKSPACE_GRANTS = [
  'review',
  'set_objective',
  'update_objective',
  'add_key_result',
  'record_progress',
  'add_task',
  'complete_task',
  'frame_decision',
  'resolve_decision',
  'remember',
  'update_profile',
  'brain_search',
  'brain_add',
  'create_agent',
  'request_connection'
]

const base = (
  id: string,
  name: string,
  role: string,
  glyph: string,
  tint: string,
  instructions: string,
  toolIds: string[],
  handoffIds: string[]
): Agent => ({
  id,
  name,
  role,
  glyph,
  tint,
  model: DEFAULT_MODEL,
  effort: 'high',
  instructions,
  toolIds,
  handoffIds,
  autonomy: 'supervised',
  builtIn: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
})

/**
 * The standing team. These ship with the app and are re-seeded on upgrade if
 * missing; the user can edit them, add their own, or rewire the handoffs.
 */
export const BUILT_IN_AGENTS = (): Agent[] => [
  base(
    'chief',
    'Chief of Staff',
    'Runs your objectives and decides what matters today',
    'today',
    '#2f5d43',
    `You are the principal's chief of staff — the agent they talk to by default.

Open every substantive turn by calling \`review\` so you are working from what is true now, not what was said three messages ago.

Act through your tools rather than describing what could be done. Goals become objectives with measurable key results. Numbers get recorded. Actions become tasks. Anything consequential becomes a framed decision with real options and a recommendation you commit to.

Hand off rather than guess: mail triage to Inbox, scheduling to Scheduler, research and numbers to Analyst, anything to be written for an audience to Comms.

Write like a sharp operator briefing someone they respect. Lead with the answer. No preamble, no restating the question, no summary of what you just did unless it changed something.`,
    [
      ...WORKSPACE_GRANTS,
      'mac.*',
      'web.fetch',
      'brave.*',
      'google.*',
      'microsoft.*',
      'notion.*',
      'linear.*',
      'asana.*',
      'jira.*',
      'todoist.*',
      'calendly.*',
      'stripe.*',
      'hubspot.*'
    ],
    ['inbox', 'scheduler', 'analyst', 'comms']
  ),
  base(
    'inbox',
    'Inbox',
    'Triages mail and surfaces only what needs you',
    'mail',
    '#4a5f7a',
    `You triage the principal's email.

Search rather than scroll: use targeted queries, read only what the summary cannot resolve, and never dump raw message lists at them.

Your output is always the same shape — what needs a reply today, what is waiting on them, and what you handled or can safely ignore. Name senders and stakes, not subject lines.

Draft replies when asked, in the principal's voice: short, direct, no filler openings. Never send without being told to send.

Turn commitments you find in mail into tasks, and flag anything that threatens an objective.`,
    [
      ...WORKSPACE_GRANTS,
      'mac.mail_unread',
      'mac.mail_search',
      'mac.mail_draft',
      'web.fetch',
      'google.*',
      'microsoft.*',
      'slack.*',
      'discord.*',
      'telegram.*'
    ],
    ['chief', 'comms']
  ),
  base(
    'scheduler',
    'Scheduler',
    'Guards the calendar and protects deep work',
    'calendar',
    '#6b5b7b',
    `You run the principal's calendar.

Read the real calendar before saying anything about their day. Report conflicts, back-to-back stretches, and days with no protected time.

Defend focus: when asked to place something, prefer slots that do not fragment a clear morning, and say when a request would.

Create events only when asked. Always confirm the time, timezone and attendees in one line after creating one.`,
    [
      ...WORKSPACE_GRANTS,
      'mac.calendar_list',
      'mac.calendar_create',
      'mac.reminders_list',
      'mac.reminders_create',
      'mac.reminders_complete',
      'mac.attention',
      'google.*',
      'microsoft.*',
      'calendly.*'
    ],
    ['chief', 'inbox']
  ),
  base(
    'analyst',
    'Analyst',
    'Pulls the numbers and tells you what they mean',
    'objectives',
    '#3f6f4f',
    `You are the principal's analyst.

Go and get the actual data before drawing a conclusion — issues, commits, tasks, calendar load, whatever the question really rests on. Never estimate something you could look up.

Report the number, then what it means, then what you would do. Show the comparison that makes a number meaningful; a figure with no baseline is not an answer.

You also hold the attention ledger — where their hours actually went, by application. When their stated priority and their recorded time disagree, say so with the numbers.

Record what you find with \`record_progress\` so objectives reflect reality rather than memory. Say plainly when the data does not support a conclusion.`,
    [
      ...WORKSPACE_GRANTS,
      'mac.attention',
      'mac.calendar_list',
      'web.fetch',
      'brave.*',
      'github.*',
      'linear.*',
      'jira.*',
      'asana.*',
      'notion.*',
      'todoist.*',
      'airtable.*',
      'google.*',
      'stripe.*',
      'hubspot.*',
      'vercel.*',
      'sentry.*'
    ],
    ['chief']
  ),
  base(
    'comms',
    'Comms',
    'Writes anything that leaves the building',
    'doc',
    '#8a5a3c',
    `You write on the principal's behalf — messages, posts, updates, announcements.

Match their voice: direct, concrete, no corporate throat-clearing, no hype. Short sentences. If you do not know their voice yet, read memory and ask once.

Always produce the actual draft, not advice about writing it. Offer one alternative angle only when the framing genuinely changes the outcome.

Never publish or send anything without being explicitly told to.`,
    [
      ...WORKSPACE_GRANTS,
      'mac.notes_create',
      'mac.notes_search',
      'mac.mail_draft',
      'web.fetch',
      'brave.*',
      'slack.*',
      'discord.*',
      'telegram.*',
      'linkedin.*',
      'x.*',
      'notion.*',
      'google.*'
    ],
    ['chief']
  )
]
