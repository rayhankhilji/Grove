import type Anthropic from '@anthropic-ai/sdk'
import type {
  Agent,
  AppState,
  Decision,
  DecisionOption,
  Horizon,
  KeyResult,
  Objective,
  ObjectiveStatus,
  Task
} from '@shared/types'
import { CONNECTORS, connectorToolId } from '@shared/connectors'
import { ACTIONS } from './connectors/clients'
import {
  calendarCreate,
  calendarList,
  mailDraft,
  mailSearch,
  mailUnread,
  notesCreate,
  notesRead,
  notesSearch,
  remindersComplete,
  remindersCreate,
  remindersList
} from './native/apple'
import { attentionReport, currentFocus } from './native/context'
import { brainTools } from './brain'
import { vault } from './vault'
import { id, now, store } from './store'

export interface ToolDef {
  /** Stable id: a bare name for workspace tools, `provider.action` for connectors. */
  id: string
  description: string
  schema: Anthropic.Tool['input_schema']
  run: (input: Record<string, any>) => string | Promise<string>
  /** Write actions can be gated behind approval for supervised agents. */
  write: boolean
  provider?: string
  label: string
}

/* ── Schema helpers ──────────────────────────────────────────────────────── */

const str = (description: string): Record<string, unknown> => ({ type: 'string', description })
const num = (description: string): Record<string, unknown> => ({ type: 'number', description })
const enumOf = (values: string[], description: string): Record<string, unknown> => ({
  type: 'string',
  enum: values,
  description
})
const object = (
  properties: Record<string, unknown>,
  required: string[]
): Anthropic.Tool['input_schema'] =>
  ({ type: 'object', properties, required }) as Anthropic.Tool['input_schema']

/**
 * Resolves a reference the model supplied, which may be an id or the title it
 * saw in an earlier tool result. Title matching keeps the agent working without
 * forcing it to echo UUIDs perfectly.
 */
const resolve = <T extends { id: string }>(
  items: T[],
  ref: string,
  titleOf: (item: T) => string
): T | undefined => {
  const needle = ref.trim().toLowerCase()
  return (
    items.find((item) => item.id === ref) ??
    items.find((item) => titleOf(item).toLowerCase() === needle) ??
    items.find((item) => titleOf(item).toLowerCase().includes(needle))
  )
}

const percent = (kr: KeyResult): number => {
  const span = kr.target - kr.start
  if (span === 0) return kr.current >= kr.target ? 100 : 0
  return Math.max(0, Math.min(100, Math.round(((kr.current - kr.start) / span) * 100)))
}

export const objectiveProgress = (objective: Objective): number => {
  if (objective.keyResults.length === 0) return objective.status === 'achieved' ? 100 : 0
  return Math.round(
    objective.keyResults.reduce((sum, kr) => sum + percent(kr), 0) / objective.keyResults.length
  )
}

/* ── State snapshot ──────────────────────────────────────────────────────── */

const describeObjective = (o: Objective): string =>
  [
    `  • [${o.id}] ${o.title} — ${o.status}, ${o.horizon}, ${objectiveProgress(o)}%` +
      (o.dueDate ? `, due ${o.dueDate}` : ''),
    o.why ? `      why: ${o.why}` : '',
    ...o.keyResults.map(
      (kr) => `      - ${kr.title}: ${kr.current}/${kr.target} ${kr.unit} (${percent(kr)}%)`
    )
  ]
    .filter(Boolean)
    .join('\n')

export const snapshot = (state: AppState): string => {
  const open = state.objectives.filter((o) => o.status === 'active' || o.status === 'paused')
  const openTasks = state.tasks.filter((t) => !t.done)
  const openDecisions = state.decisions.filter((d) => d.status === 'open')

  return [
    `PRINCIPAL: ${state.profile.name || 'unknown'}` +
      (state.profile.role ? `, ${state.profile.role}` : '') +
      (state.profile.venture ? ` at ${state.profile.venture}` : ''),
    state.profile.mission ? `MISSION: ${state.profile.mission}` : '',
    state.profile.operatingStyle ? `OPERATING STYLE: ${state.profile.operatingStyle}` : '',
    '',
    `OBJECTIVES (${open.length} open):`,
    open.length ? open.map(describeObjective).join('\n') : '  (none)',
    '',
    `OPEN TASKS (${openTasks.length}):`,
    openTasks.length
      ? openTasks.map((t) => `  • [${t.id}] ${t.title} (${t.horizon})`).join('\n')
      : '  (none)',
    '',
    `DECISIONS (${openDecisions.length} open):`,
    openDecisions.length
      ? openDecisions.map((d) => `  • [${d.id}] ${d.question}`).join('\n')
      : '  (none)',
    '',
    `MEMORY (${state.memories.length} notes):`,
    state.memories.length
      ? state.memories.slice(-20).map((m) => `  • (${m.tag}) ${m.text}`).join('\n')
      : '  (none)'
  ].join('\n')
}

/* ── Workspace tools ─────────────────────────────────────────────────────── */

const horizons = ['now', 'next', 'later']
const statuses = ['active', 'paused', 'achieved', 'dropped']

const workspaceTools: ToolDef[] = [
  {
    id: 'review',
    label: 'Review the workspace',
    write: false,
    description:
      'Read the full current state: profile, objectives with key results, open tasks, decisions and memory. Call this before advising, planning, or answering anything about how things stand.',
    schema: object({}, []),
    run: () => snapshot(store.get())
  },
  {
    id: 'set_objective',
    label: 'Set an objective',
    write: true,
    description:
      'Create a new objective. Use for a meaningful outcome, not a to-do item. Add key results separately.',
    schema: object(
      {
        title: str('Short outcome-shaped title, e.g. "Reach $40k MRR".'),
        why: str('Why this matters to the principal.'),
        horizon: enumOf(horizons, 'now = this week, next = this quarter, later = beyond.'),
        due_date: str('Optional target date as YYYY-MM-DD.')
      },
      ['title', 'why', 'horizon']
    ),
    run: (input) => {
      const objective: Objective = {
        id: id(),
        title: String(input.title),
        why: String(input.why ?? ''),
        status: 'active',
        horizon: (horizons.includes(input.horizon) ? input.horizon : 'next') as Horizon,
        dueDate: input.due_date ? String(input.due_date) : null,
        keyResults: [],
        createdAt: now(),
        updatedAt: now()
      }
      store.update((s) => {
        s.objectives.push(objective)
      })
      return `Created objective [${objective.id}] "${objective.title}".`
    }
  },
  {
    id: 'update_objective',
    label: 'Update an objective',
    write: true,
    description: "Change an objective's status, horizon, due date or framing.",
    schema: object(
      {
        objective: str('Objective id or title.'),
        status: enumOf(statuses, 'New status.'),
        horizon: enumOf(horizons, 'New horizon.'),
        due_date: str('New target date as YYYY-MM-DD, or "none" to clear.'),
        why: str('Revised reason this matters.')
      },
      ['objective']
    ),
    run: (input) => {
      const objective = resolve(store.get().objectives, String(input.objective), (o) => o.title)
      if (!objective) return `No objective matches "${input.objective}".`
      store.update(() => {
        if (statuses.includes(input.status)) objective.status = input.status as ObjectiveStatus
        if (horizons.includes(input.horizon)) objective.horizon = input.horizon as Horizon
        if (input.due_date)
          objective.dueDate = input.due_date === 'none' ? null : String(input.due_date)
        if (input.why) objective.why = String(input.why)
        objective.updatedAt = now()
      })
      return `Updated "${objective.title}" — now ${objective.status}, ${objective.horizon}.`
    }
  },
  {
    id: 'add_key_result',
    label: 'Add a key result',
    write: true,
    description:
      'Attach a measurable key result to an objective. Always give a numeric start and target so progress is real rather than guessed.',
    schema: object(
      {
        objective: str('Objective id or title.'),
        title: str('What is measured, e.g. "Monthly recurring revenue".'),
        start: num('Current value today, the baseline.'),
        target: num('Value that counts as done.'),
        unit: str('Unit, e.g. "$", "users", "posts".')
      },
      ['objective', 'title', 'start', 'target', 'unit']
    ),
    run: (input) => {
      const objective = resolve(store.get().objectives, String(input.objective), (o) => o.title)
      if (!objective) return `No objective matches "${input.objective}".`
      const kr: KeyResult = {
        id: id(),
        title: String(input.title),
        start: Number(input.start),
        current: Number(input.start),
        target: Number(input.target),
        unit: String(input.unit)
      }
      store.update(() => {
        objective.keyResults.push(kr)
        objective.updatedAt = now()
      })
      return `Added "${kr.title}" (${kr.start} → ${kr.target} ${kr.unit}) to "${objective.title}".`
    }
  },
  {
    id: 'record_progress',
    label: 'Record progress',
    write: true,
    description:
      'Update the current value of a key result. This is how objectives actually move — use it whenever a number is reported.',
    schema: object(
      { key_result: str('Key result id or title.'), current: num('The new current value.') },
      ['key_result', 'current']
    ),
    run: (input) => {
      for (const objective of store.get().objectives) {
        const kr = resolve(objective.keyResults, String(input.key_result), (k) => k.title)
        if (!kr) continue
        store.update(() => {
          kr.current = Number(input.current)
          objective.updatedAt = now()
        })
        return `"${kr.title}" is now ${kr.current}/${kr.target} ${kr.unit} (${percent(kr)}%). "${objective.title}" overall: ${objectiveProgress(objective)}%.`
      }
      return `No key result matches "${input.key_result}".`
    }
  },
  {
    id: 'add_task',
    label: 'Capture a task',
    write: true,
    description: 'Capture a concrete next action, small enough to finish in one sitting.',
    schema: object(
      {
        title: str('The action, phrased as a verb.'),
        horizon: enumOf(horizons, 'now = today, next = this week, later = someday.'),
        objective: str('Optional objective id or title this serves.')
      },
      ['title', 'horizon']
    ),
    run: (input) => {
      const objective = input.objective
        ? resolve(store.get().objectives, String(input.objective), (o) => o.title)
        : undefined
      const task: Task = {
        id: id(),
        title: String(input.title),
        objectiveId: objective?.id ?? null,
        horizon: (horizons.includes(input.horizon) ? input.horizon : 'now') as Horizon,
        done: false,
        createdBy: null,
        createdAt: now(),
        completedAt: null
      }
      store.update((s) => {
        s.tasks.push(task)
      })
      return `Added task "${task.title}" (${task.horizon})${objective ? ` under "${objective.title}".` : '.'}`
    }
  },
  {
    id: 'complete_task',
    label: 'Complete a task',
    write: true,
    description: 'Mark a task done.',
    schema: object({ task: str('Task id or title.') }, ['task']),
    run: (input) => {
      const task = resolve(
        store.get().tasks.filter((t) => !t.done),
        String(input.task),
        (t) => t.title
      )
      if (!task) return `No open task matches "${input.task}".`
      store.update(() => {
        task.done = true
        task.completedAt = now()
      })
      return `Completed "${task.title}".`
    }
  },
  {
    id: 'frame_decision',
    label: 'Frame a decision',
    write: true,
    description:
      'Log a decision the principal is facing, with the real options and your recommendation. Use this for anything consequential rather than answering in prose only.',
    schema: object(
      {
        question: str('The decision, phrased as a question.'),
        context: str('What is true right now that makes this live.'),
        options: {
          type: 'array',
          description: 'Two or more genuine options.',
          items: object(
            {
              label: str('Name of the option.'),
              upside: str('What it gets them.'),
              risk: str('What it costs or risks.')
            },
            ['label', 'upside', 'risk']
          )
        },
        recommendation: str('Which option you would take and why. Commit to one.')
      },
      ['question', 'context', 'options', 'recommendation']
    ),
    run: (input) => {
      const options = Array.isArray(input.options) ? (input.options as DecisionOption[]) : []
      const decision: Decision = {
        id: id(),
        question: String(input.question),
        context: String(input.context ?? ''),
        options: options.map((o) => ({
          label: String(o.label ?? ''),
          upside: String(o.upside ?? ''),
          risk: String(o.risk ?? '')
        })),
        recommendation: String(input.recommendation ?? ''),
        status: 'open',
        chosen: null,
        rationale: null,
        createdAt: now(),
        decidedAt: null
      }
      store.update((s) => {
        s.decisions.push(decision)
      })
      return `Logged decision [${decision.id}] with ${decision.options.length} options.`
    }
  },
  {
    id: 'resolve_decision',
    label: 'Resolve a decision',
    write: true,
    description: 'Close out a decision once the principal has chosen.',
    schema: object(
      {
        decision: str('Decision id or question.'),
        chosen: str('The option label they picked.'),
        rationale: str('Why, in their words where possible.')
      },
      ['decision', 'chosen']
    ),
    run: (input) => {
      const decision = resolve(store.get().decisions, String(input.decision), (d) => d.question)
      if (!decision) return `No decision matches "${input.decision}".`
      store.update(() => {
        decision.status = 'decided'
        decision.chosen = String(input.chosen)
        decision.rationale = input.rationale ? String(input.rationale) : null
        decision.decidedAt = now()
      })
      return `Decided "${decision.question}" → ${decision.chosen}.`
    }
  },
  {
    id: 'remember',
    label: 'Commit to memory',
    write: true,
    description:
      'Save a durable fact about the principal, their venture, or their preferences — something still true next month.',
    schema: object(
      {
        text: str('The fact, written so it stands alone.'),
        tag: str('One-word category, e.g. "preference", "constraint", "context".')
      },
      ['text', 'tag']
    ),
    run: (input) => {
      store.update((s) => {
        s.memories.push({
          id: id(),
          text: String(input.text),
          tag: String(input.tag ?? 'note'),
          createdAt: now()
        })
      })
      return `Remembered: ${input.text}`
    }
  },
  {
    id: 'update_profile',
    label: 'Update the profile',
    write: true,
    description: 'Set who the principal is and how they want to be run.',
    schema: object(
      {
        name: str('Their name.'),
        role: str('Their role.'),
        venture: str('Company, project or practice.'),
        mission: str('What they are ultimately trying to do.'),
        operating_style: str('How they want to be advised.')
      },
      []
    ),
    run: (input) => {
      store.update((s) => {
        if (input.name) s.profile.name = String(input.name)
        if (input.role) s.profile.role = String(input.role)
        if (input.venture) s.profile.venture = String(input.venture)
        if (input.mission) s.profile.mission = String(input.mission)
        if (input.operating_style) s.profile.operatingStyle = String(input.operating_style)
      })
      return 'Profile updated.'
    }
  }
]

/* ── Connector tool schemas ──────────────────────────────────────────────── */

const CONNECTOR_SCHEMAS: Record<string, Anthropic.Tool['input_schema']> = {
  'google.gmail_search': object(
    {
      query: str('Gmail search syntax, e.g. "is:unread newer_than:2d from:boss@acme.com".'),
      limit: num('Max messages, default 10.')
    },
    ['query']
  ),
  'google.gmail_read': object({ id: str('Message id from a search result.') }, ['id']),
  'google.gmail_send': object(
    { to: str('Recipient address.'), subject: str('Subject line.'), body: str('Plain text body.') },
    ['to', 'subject', 'body']
  ),
  'google.gmail_draft': object(
    { to: str('Recipient address.'), subject: str('Subject line.'), body: str('Plain text body.') },
    ['to', 'subject', 'body']
  ),
  'google.gcal_list': object({ days: num('How many days ahead to read, default 1.') }, []),
  'google.gcal_create': object(
    {
      title: str('Event title.'),
      start: str('Start time as an ISO 8601 timestamp.'),
      end: str('End time as ISO 8601. Defaults to one hour after start.'),
      description: str('Optional description.'),
      attendees: str('Comma-separated email addresses.')
    },
    ['title', 'start']
  ),

  'microsoft.outlook_search': object(
    { query: str('Search terms. Leave empty for the newest mail.'), limit: num('Max messages, default 10.') },
    []
  ),
  'microsoft.outlook_read': object({ id: str('Message id from a search result.') }, ['id']),
  'microsoft.outlook_send': object(
    { to: str('Comma-separated recipients.'), subject: str('Subject line.'), body: str('Plain text body.') },
    ['to', 'subject', 'body']
  ),
  'microsoft.mscal_list': object({ days: num('How many days ahead, default 1.') }, []),
  'microsoft.mscal_create': object(
    {
      title: str('Event title.'),
      start: str('Start as ISO 8601.'),
      end: str('End as ISO 8601.'),
      description: str('Optional description.'),
      attendees: str('Comma-separated email addresses.')
    },
    ['title', 'start']
  ),

  'slack.slack_channels': object({}, []),
  'slack.slack_history': object(
    { channel: str('Channel id, e.g. C012AB3CD.'), limit: num('Max messages, default 20.') },
    ['channel']
  ),
  'slack.slack_post': object(
    { channel: str('Channel id or #name.'), text: str('Message text.') },
    ['channel', 'text']
  ),

  'linkedin.linkedin_me': object({}, []),
  'linkedin.linkedin_post': object({ text: str('Post body.') }, ['text']),

  'notion.notion_search': object(
    { query: str('Search terms.'), limit: num('Max results, default 10.') },
    ['query']
  ),
  'notion.notion_read': object({ id: str('Page id.') }, ['id']),
  'notion.notion_create': object(
    {
      parent_id: str('Parent page id the integration can access.'),
      title: str('Page title.'),
      body: str('Body text; newlines become paragraphs.')
    },
    ['parent_id', 'title']
  ),

  'linear.linear_issues': object({ limit: num('Max issues, default 20.') }, []),
  'linear.linear_create': object(
    {
      title: str('Issue title.'),
      description: str('Issue description.'),
      team: str('Team key, e.g. ENG. Defaults to your first team.')
    },
    ['title']
  ),
  'linear.linear_comment': object(
    { issue_id: str('Issue id.'), body: str('Comment body.') },
    ['issue_id', 'body']
  ),

  'github.github_issues': object({ limit: num('Max items, default 20.') }, []),
  'github.github_repo': object({ repo: str('Repository as owner/name.') }, ['repo']),
  'github.github_issue_create': object(
    { repo: str('Repository as owner/name.'), title: str('Issue title.'), body: str('Issue body.') },
    ['repo', 'title']
  ),

  'todoist.todoist_list': object({}, []),
  'todoist.todoist_create': object(
    { content: str('Task text.'), due: str('Natural language due date, e.g. "tomorrow 9am".') },
    ['content']
  ),
  'todoist.todoist_close': object({ id: str('Task id.') }, ['id'])
}

const connectorTools: ToolDef[] = CONNECTORS.flatMap((connector) =>
  connector.actions.map<ToolDef>((action) => {
    const toolId = connectorToolId(connector.id, action.id)
    return {
      id: toolId,
      label: `${connector.name} · ${action.label}`,
      description: `${action.description} (${connector.name})`,
      schema: CONNECTOR_SCHEMAS[toolId] ?? object({}, []),
      write: action.write,
      provider: connector.id,
      run: async (input) => {
        const fn = ACTIONS[toolId]
        if (!fn) throw new Error(`No client implements ${toolId}.`)
        return fn(input)
      }
    }
  })
)


/* ── Native macOS tools ──────────────────────────────────────────────────── */

/**
 * These reach the Apple apps already signed in on this Mac. They need no
 * OAuth and no network round trip, which is why they are always available
 * rather than gated behind a connection.
 */
const brainToolDefs: ToolDef[] = [
  {
    id: 'brain_search',
    label: 'Search the company brain',
    description:
      'Search the collected context layer — everything the principal has filed about their company, market, customers and history. Check here before asking them something they may already have written down.',
    schema: object(
      { query: str('What you are looking for.'), limit: num('Max entries, default 5.') },
      ['query']
    ),
    write: false,
    run: brainTools.search
  },
  {
    id: 'brain_add',
    label: 'File in the company brain',
    description:
      'Add durable knowledge about the company to the brain so every future agent and boardroom seat has it. Use for facts that will still matter next quarter, not for conversational detail.',
    schema: object(
      {
        title: str('Short descriptive title.'),
        body: str('The knowledge, written so it stands alone.'),
        tags: str('Comma-separated tags.')
      },
      ['title', 'body']
    ),
    write: true,
    run: brainTools.add
  }
]

const nativeTools: ToolDef[] = [
  {
    id: 'mac.calendar_list',
    label: 'Apple Calendar · Read events',
    description: 'Read events from the Calendar app on this Mac, across every account signed in there.',
    schema: object({ days: num('How many days ahead to read, default 1.') }, []),
    write: false,
    run: calendarList
  },
  {
    id: 'mac.calendar_create',
    label: 'Apple Calendar · Create event',
    description: 'Add an event to the Calendar app on this Mac.',
    schema: object(
      {
        title: str('Event title.'),
        start: str('Start time as an ISO 8601 timestamp.'),
        end: str('End time as ISO 8601. Defaults to one hour after start.'),
        description: str('Optional notes.'),
        location: str('Optional location.'),
        calendar: str('Calendar name. Defaults to your default calendar.')
      },
      ['title', 'start']
    ),
    write: true,
    run: calendarCreate
  },
  {
    id: 'mac.reminders_list',
    label: 'Apple Reminders · Read',
    description: 'Read open reminders from the Reminders app on this Mac.',
    schema: object({ list: str('Optional list name to filter by.') }, []),
    write: false,
    run: remindersList
  },
  {
    id: 'mac.reminders_create',
    label: 'Apple Reminders · Add',
    description: 'Add a reminder to the Reminders app on this Mac.',
    schema: object(
      {
        title: str('What to be reminded of.'),
        due: str('Optional due time as ISO 8601.'),
        notes: str('Optional notes.'),
        list: str('Optional list name.')
      },
      ['title']
    ),
    write: true,
    run: remindersCreate
  },
  {
    id: 'mac.reminders_complete',
    label: 'Apple Reminders · Complete',
    description: 'Mark a reminder done by id or title.',
    schema: object({ title: str('Reminder id or title.') }, ['title']),
    write: true,
    run: remindersComplete
  },
  {
    id: 'mac.notes_search',
    label: 'Apple Notes · Search',
    description: 'Search the Notes app on this Mac by title and body.',
    schema: object({ query: str('Search terms. Empty returns recent notes.') }, []),
    write: false,
    run: notesSearch
  },
  {
    id: 'mac.notes_read',
    label: 'Apple Notes · Read',
    description: 'Read one note in full.',
    schema: object({ note: str('Note id or title.') }, ['note']),
    write: false,
    run: notesRead
  },
  {
    id: 'mac.notes_create',
    label: 'Apple Notes · Create',
    description: 'Create a note in the Notes app on this Mac.',
    schema: object({ title: str('Note title.'), body: str('Note body.') }, ['title']),
    write: true,
    run: notesCreate
  },
  {
    id: 'mac.mail_unread',
    label: 'Apple Mail · Unread',
    description: 'Read unread messages from the Mail app on this Mac.',
    schema: object({ limit: num('Max messages, default 15.') }, []),
    write: false,
    run: mailUnread
  },
  {
    id: 'mac.mail_search',
    label: 'Apple Mail · Search',
    description: 'Search Mail on this Mac by sender or subject.',
    schema: object({ query: str('Search terms.'), limit: num('Max messages, default 15.') }, ['query']),
    write: false,
    run: mailSearch
  },
  {
    id: 'mac.mail_draft',
    label: 'Apple Mail · Draft',
    description: 'Open a pre-filled draft in Mail. Never sends — the principal reviews and sends it.',
    schema: object(
      { to: str('Recipient address.'), subject: str('Subject line.'), body: str('Message body.') },
      ['to', 'subject', 'body']
    ),
    write: true,
    run: mailDraft
  },
  {
    id: 'mac.attention',
    label: 'Attention ledger',
    description:
      'Where the principal actually spent their time, by application, over recent days. Use this to check whether their hours match their stated priorities.',
    schema: object({ days: num('How many days back, default 1.') }, []),
    write: false,
    run: attentionReport
  },
  {
    id: 'mac.focus_now',
    label: 'What they are doing now',
    description: 'The application and window the principal is looking at right now.',
    schema: object({}, []),
    write: false,
    run: currentFocus
  }
]

export const ALL_TOOLS: ToolDef[] = [
  ...workspaceTools,
  ...brainToolDefs,
  ...nativeTools,
  ...connectorTools
]

const byId = new Map(ALL_TOOLS.map((tool) => [tool.id, tool]))

/** Tool names on the wire cannot contain dots, so ids are flattened. */
const wireName = (toolId: string): string => toolId.replace(/\./g, '__')
const fromWire = (name: string): string => name.replace(/__/g, '.')

export const toolById = (toolId: string): ToolDef | undefined => byId.get(toolId)

/** A provider is usable only once a live credential exists for it. */
export const providerConnected = (providerId: string): boolean =>
  Boolean(vault.provider(providerId).accessToken)

/**
 * The tools an agent may actually call right now: its own allowlist, minus
 * anything belonging to a provider that is not connected.
 */
export const toolsForAgent = (agent: Agent): ToolDef[] =>
  ALL_TOOLS.filter(
    (tool) =>
      agent.toolIds.includes(tool.id) && (!tool.provider || providerConnected(tool.provider))
  )

export const definitionsFor = (tools: ToolDef[]): Anthropic.Tool[] =>
  tools.map((tool) => ({
    name: wireName(tool.id),
    description: tool.description,
    input_schema: tool.schema
  }))

export const runToolByWireName = async (
  name: string,
  input: Record<string, unknown>
): Promise<{ result: string; isError: boolean; tool?: ToolDef }> => {
  const tool = byId.get(fromWire(name))
  if (!tool) return { result: `Unknown tool "${name}".`, isError: true }
  try {
    return { result: await tool.run(input), isError: false, tool }
  } catch (error) {
    return { result: `Tool failed: ${(error as Error).message}`, isError: true, tool }
  }
}

/** Used by the engine test and by any caller that already knows the tool id. */
export const runTool = async (
  toolId: string,
  input: Record<string, unknown>
): Promise<{ result: string; isError: boolean }> => runToolByWireName(wireName(toolId), input)
