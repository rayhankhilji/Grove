import { accessToken } from './oauth'

/* ── HTTP plumbing ───────────────────────────────────────────────────────── */

/** Providers differ on how the credential is presented. */
const authHeader = async (provider: string): Promise<Record<string, string>> => {
  const token = await accessToken(provider)
  switch (provider) {
    case 'linear':
      // Linear personal API keys are sent bare, not as a bearer token.
      return { Authorization: token }
    case 'notion':
      return { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' }
    case 'github':
      return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    default:
      return { Authorization: `Bearer ${token}` }
  }
}

const call = async <T>(
  provider: string,
  url: string,
  init: RequestInit = {}
): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(await authHeader(provider)),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string>)
    }
  })

  const text = await response.text()
  const body = text ? (JSON.parse(text) as T & { error?: unknown; ok?: boolean }) : ({} as T)

  if (!response.ok) {
    const detail =
      (body as { error?: { message?: string } })?.error?.message ??
      (typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : text.slice(0, 200))
    throw new Error(`${provider} API ${response.status}: ${detail || response.statusText}`)
  }
  // Slack answers 200 even on failure; the real verdict is `ok`.
  if ((body as { ok?: boolean }).ok === false) {
    throw new Error(`${provider} API error: ${String((body as { error?: string }).error)}`)
  }
  return body
}

const json = (value: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(value) })

/** Keeps tool results readable and bounded rather than dumping raw payloads. */
const lines = (items: string[], empty: string): string =>
  items.length ? items.join('\n') : empty

const clip = (text: string, max = 4000): string =>
  text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text

const base64url = (value: string): string =>
  Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const iso = (value: unknown, fallbackDays = 0): string => {
  const date = value ? new Date(String(value)) : new Date(Date.now() + fallbackDays * 864e5)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

/* ── Gmail & Google Calendar ─────────────────────────────────────────────── */

interface GmailList {
  messages?: { id: string }[]
}
interface GmailMessage {
  id: string
  snippet?: string
  payload?: {
    headers?: { name: string; value: string }[]
    body?: { data?: string }
    parts?: GmailMessage['payload'][]
  }
}

const header = (message: GmailMessage, name: string): string =>
  message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''

/** Walks the MIME tree for the first text/plain body. */
const gmailBody = (part: GmailMessage['payload']): string => {
  if (!part) return ''
  if (part.body?.data) return Buffer.from(part.body.data, 'base64url').toString('utf8')
  for (const child of part.parts ?? []) {
    const found = gmailBody(child)
    if (found) return found
  }
  return ''
}

const gmail = {
  search: async (input: Record<string, any>): Promise<string> => {
    const limit = Math.min(Number(input.limit) || 10, 25)
    const query = encodeURIComponent(String(input.query ?? 'is:unread'))
    const list = await call<GmailList>(
      'google',
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${limit}`
    )
    const summaries = await Promise.all(
      (list.messages ?? []).map(async (entry) => {
        const message = await call<GmailMessage>(
          'google',
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${entry.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
        )
        return `[${entry.id}] ${header(message, 'From')} — ${header(message, 'Subject')} (${header(message, 'Date')})\n    ${message.snippet ?? ''}`
      })
    )
    return lines(summaries, 'No messages matched.')
  },

  read: async (input: Record<string, any>): Promise<string> => {
    const message = await call<GmailMessage>(
      'google',
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${String(input.id)}?format=full`
    )
    return clip(
      `From: ${header(message, 'From')}\nTo: ${header(message, 'To')}\nSubject: ${header(message, 'Subject')}\nDate: ${header(message, 'Date')}\n\n${gmailBody(message.payload) || message.snippet || '(no readable body)'}`
    )
  },

  compose: (input: Record<string, any>): string =>
    base64url(
      [
        `To: ${String(input.to)}`,
        `Subject: ${String(input.subject ?? '')}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        String(input.body ?? '')
      ].join('\r\n')
    ),

  send: async (input: Record<string, any>): Promise<string> => {
    await call('google', 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send', json({ raw: gmail.compose(input) }))
    return `Sent to ${String(input.to)}.`
  },

  draft: async (input: Record<string, any>): Promise<string> => {
    await call('google', 'https://gmail.googleapis.com/gmail/v1/users/me/drafts', json({ message: { raw: gmail.compose(input) } }))
    return `Draft saved for ${String(input.to)}.`
  }
}

interface GCalEvent {
  id: string
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  attendees?: { email: string }[]
  location?: string
}

const gcal = {
  list: async (input: Record<string, any>): Promise<string> => {
    const days = Math.min(Number(input.days) || 1, 30)
    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + days * 864e5).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50'
    })
    const data = await call<{ items?: GCalEvent[] }>(
      'google',
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`
    )
    return lines(
      (data.items ?? []).map((event) => {
        const start = event.start?.dateTime ?? event.start?.date ?? ''
        const when = start ? new Date(start).toLocaleString() : 'unscheduled'
        const who = event.attendees?.length ? ` · ${event.attendees.length} attendees` : ''
        return `[${event.id}] ${when} — ${event.summary ?? '(untitled)'}${who}`
      }),
      `Nothing on the calendar for the next ${days} day(s).`
    )
  },

  create: async (input: Record<string, any>): Promise<string> => {
    const start = iso(input.start)
    const end = input.end ? iso(input.end) : new Date(new Date(start).getTime() + 36e5).toISOString()
    const event = await call<GCalEvent>(
      'google',
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      json({
        summary: String(input.title ?? 'Untitled'),
        description: input.description ? String(input.description) : undefined,
        start: { dateTime: start },
        end: { dateTime: end },
        attendees: String(input.attendees ?? '')
          .split(',')
          .map((email) => email.trim())
          .filter(Boolean)
          .map((email) => ({ email }))
      })
    )
    return `Created "${event.summary}" on ${new Date(start).toLocaleString()}.`
  }
}

/* ── Microsoft Graph ─────────────────────────────────────────────────────── */

interface GraphMessage {
  id: string
  subject?: string
  bodyPreview?: string
  receivedDateTime?: string
  from?: { emailAddress?: { name?: string; address?: string } }
  body?: { content?: string }
  toRecipients?: { emailAddress?: { address?: string } }[]
}

const GRAPH = 'https://graph.microsoft.com/v1.0'

const outlook = {
  search: async (input: Record<string, any>): Promise<string> => {
    const limit = Math.min(Number(input.limit) || 10, 25)
    const query = String(input.query ?? '').trim()
    // $search and $filter cannot be combined, so unqualified reads just take the newest.
    const url = query
      ? `${GRAPH}/me/messages?$search=${encodeURIComponent(`"${query}"`)}&$top=${limit}`
      : `${GRAPH}/me/messages?$top=${limit}&$orderby=receivedDateTime desc`
    const data = await call<{ value?: GraphMessage[] }>('microsoft', url)
    return lines(
      (data.value ?? []).map((message) => {
        const from = message.from?.emailAddress
        const when = message.receivedDateTime ? new Date(message.receivedDateTime).toLocaleString() : ''
        return `[${message.id}] ${from?.name ?? from?.address ?? 'unknown'} — ${message.subject ?? '(no subject)'} (${when})\n    ${message.bodyPreview ?? ''}`
      }),
      'No messages matched.'
    )
  },

  read: async (input: Record<string, any>): Promise<string> => {
    const message = await call<GraphMessage>('microsoft', `${GRAPH}/me/messages/${String(input.id)}`)
    const body = (message.body?.content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    return clip(
      `From: ${message.from?.emailAddress?.address ?? ''}\nSubject: ${message.subject ?? ''}\nDate: ${message.receivedDateTime ?? ''}\n\n${body || message.bodyPreview || '(empty)'}`
    )
  },

  send: async (input: Record<string, any>): Promise<string> => {
    await call(
      'microsoft',
      `${GRAPH}/me/sendMail`,
      json({
        message: {
          subject: String(input.subject ?? ''),
          body: { contentType: 'Text', content: String(input.body ?? '') },
          toRecipients: String(input.to)
            .split(',')
            .map((address) => address.trim())
            .filter(Boolean)
            .map((address) => ({ emailAddress: { address } }))
        },
        saveToSentItems: true
      })
    )
    return `Sent to ${String(input.to)}.`
  }
}

interface GraphEvent {
  id: string
  subject?: string
  start?: { dateTime?: string }
  end?: { dateTime?: string }
  attendees?: unknown[]
}

const mscal = {
  list: async (input: Record<string, any>): Promise<string> => {
    const days = Math.min(Number(input.days) || 1, 30)
    const params = new URLSearchParams({
      startDateTime: new Date().toISOString(),
      endDateTime: new Date(Date.now() + days * 864e5).toISOString(),
      $orderby: 'start/dateTime',
      $top: '50'
    })
    const data = await call<{ value?: GraphEvent[] }>('microsoft', `${GRAPH}/me/calendarView?${params}`)
    return lines(
      (data.value ?? []).map((event) => {
        const when = event.start?.dateTime ? new Date(`${event.start.dateTime}Z`).toLocaleString() : ''
        return `[${event.id}] ${when} — ${event.subject ?? '(untitled)'}`
      }),
      `Nothing on the calendar for the next ${days} day(s).`
    )
  },

  create: async (input: Record<string, any>): Promise<string> => {
    const start = iso(input.start)
    const end = input.end ? iso(input.end) : new Date(new Date(start).getTime() + 36e5).toISOString()
    await call(
      'microsoft',
      `${GRAPH}/me/events`,
      json({
        subject: String(input.title ?? 'Untitled'),
        body: { contentType: 'Text', content: String(input.description ?? '') },
        start: { dateTime: start, timeZone: 'UTC' },
        end: { dateTime: end, timeZone: 'UTC' },
        attendees: String(input.attendees ?? '')
          .split(',')
          .map((address) => address.trim())
          .filter(Boolean)
          .map((address) => ({ emailAddress: { address }, type: 'required' }))
      })
    )
    return `Created "${String(input.title)}" on ${new Date(start).toLocaleString()}.`
  }
}

/* ── Slack ───────────────────────────────────────────────────────────────── */

const slack = {
  channels: async (): Promise<string> => {
    const data = await call<{ channels?: { id: string; name: string; num_members?: number }[] }>(
      'slack',
      'https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=100&exclude_archived=true'
    )
    return lines(
      (data.channels ?? []).map((channel) => `[${channel.id}] #${channel.name} (${channel.num_members ?? 0} members)`),
      'No channels visible to this token.'
    )
  },

  history: async (input: Record<string, any>): Promise<string> => {
    const limit = Math.min(Number(input.limit) || 20, 50)
    const data = await call<{ messages?: { user?: string; text?: string; ts?: string }[] }>(
      'slack',
      `https://slack.com/api/conversations.history?channel=${encodeURIComponent(String(input.channel))}&limit=${limit}`
    )
    return lines(
      (data.messages ?? [])
        .slice()
        .reverse()
        .map((message) => {
          const when = message.ts ? new Date(Number(message.ts) * 1000).toLocaleString() : ''
          return `${when} <@${message.user ?? '?'}>: ${message.text ?? ''}`
        }),
      'No messages in that channel.'
    )
  },

  post: async (input: Record<string, any>): Promise<string> => {
    await call(
      'slack',
      'https://slack.com/api/chat.postMessage',
      json({ channel: String(input.channel), text: String(input.text) })
    )
    return `Posted to ${String(input.channel)}.`
  }
}

/* ── LinkedIn ────────────────────────────────────────────────────────────── */

const linkedin = {
  me: async (): Promise<string> => {
    const profile = await call<{ name?: string; email?: string; sub?: string }>(
      'linkedin',
      'https://api.linkedin.com/v2/userinfo'
    )
    return `${profile.name ?? 'Unknown'}${profile.email ? ` <${profile.email}>` : ''} (urn:li:person:${profile.sub ?? '?'})`
  },

  post: async (input: Record<string, any>): Promise<string> => {
    const profile = await call<{ sub?: string }>('linkedin', 'https://api.linkedin.com/v2/userinfo')
    if (!profile.sub) throw new Error('Could not resolve your LinkedIn member id.')
    await call(
      'linkedin',
      'https://api.linkedin.com/v2/ugcPosts',
      {
        ...json({
          author: `urn:li:person:${profile.sub}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: String(input.text) },
              shareMediaCategory: 'NONE'
            }
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
        }),
        headers: { 'X-Restli-Protocol-Version': '2.0.0' }
      }
    )
    return 'Published to LinkedIn.'
  }
}

/* ── Notion ──────────────────────────────────────────────────────────────── */

interface NotionResult {
  id: string
  object: string
  url?: string
  properties?: Record<string, { title?: { plain_text?: string }[] }>
  title?: { plain_text?: string }[]
}

const notionTitle = (item: NotionResult): string => {
  if (item.title?.length) return item.title.map((part) => part.plain_text ?? '').join('')
  for (const property of Object.values(item.properties ?? {})) {
    if (property.title?.length) return property.title.map((part) => part.plain_text ?? '').join('')
  }
  return '(untitled)'
}

const notion = {
  search: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{ results?: NotionResult[] }>(
      'notion',
      'https://api.notion.com/v1/search',
      json({ query: String(input.query ?? ''), page_size: Math.min(Number(input.limit) || 10, 25) })
    )
    return lines(
      (data.results ?? []).map((item) => `[${item.id}] ${item.object}: ${notionTitle(item)}`),
      'Nothing matched. Remember the integration only sees pages explicitly shared with it.'
    )
  },

  read: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{
      results?: { type: string; [key: string]: any }[]
    }>('notion', `https://api.notion.com/v1/blocks/${String(input.id)}/children?page_size=100`)
    const text = (data.results ?? [])
      .map((block) => {
        const rich = block[block.type]?.rich_text as { plain_text?: string }[] | undefined
        return (rich ?? []).map((part) => part.plain_text ?? '').join('')
      })
      .filter(Boolean)
      .join('\n')
    return clip(text || '(page has no readable text blocks)')
  },

  create: async (input: Record<string, any>): Promise<string> => {
    const page = await call<{ id: string; url?: string }>(
      'notion',
      'https://api.notion.com/v1/pages',
      json({
        parent: { page_id: String(input.parent_id) },
        properties: { title: [{ text: { content: String(input.title ?? 'Untitled') } }] },
        children: String(input.body ?? '')
          .split('\n')
          .filter(Boolean)
          .map((line) => ({
            object: 'block',
            type: 'paragraph',
            paragraph: { rich_text: [{ type: 'text', text: { content: line } }] }
          }))
      })
    )
    return `Created page ${page.url ?? page.id}.`
  }
}

/* ── Linear ──────────────────────────────────────────────────────────────── */

const linearQuery = async <T>(query: string, variables: Record<string, unknown> = {}): Promise<T> => {
  const body = await call<{ data?: T; errors?: { message: string }[] }>(
    'linear',
    'https://api.linear.app/graphql',
    json({ query, variables })
  )
  if (body.errors?.length) throw new Error(body.errors.map((error) => error.message).join('; '))
  return body.data as T
}

const linear = {
  issues: async (input: Record<string, any>): Promise<string> => {
    const limit = Math.min(Number(input.limit) || 20, 50)
    const data = await linearQuery<{
      viewer: { assignedIssues: { nodes: { identifier: string; title: string; state: { name: string }; url: string }[] } }
    }>(
      `query($n:Int!){viewer{assignedIssues(first:$n,filter:{state:{type:{nin:["completed","canceled"]}}}){nodes{identifier title state{name} url}}}}`,
      { n: limit }
    )
    return lines(
      data.viewer.assignedIssues.nodes.map((issue) => `${issue.identifier} [${issue.state.name}] ${issue.title}`),
      'No open issues assigned to you.'
    )
  },

  create: async (input: Record<string, any>): Promise<string> => {
    const teams = await linearQuery<{ teams: { nodes: { id: string; key: string }[] } }>(
      `{teams(first:20){nodes{id key}}}`
    )
    const wanted = String(input.team ?? '').toUpperCase()
    const team = teams.teams.nodes.find((entry) => entry.key === wanted) ?? teams.teams.nodes[0]
    if (!team) throw new Error('No Linear team available to this key.')

    const created = await linearQuery<{ issueCreate: { issue: { identifier: string; url: string } } }>(
      `mutation($t:String!,$ti:String!,$d:String){issueCreate(input:{teamId:$t,title:$ti,description:$d}){issue{identifier url}}}`,
      { t: team.id, ti: String(input.title), d: input.description ? String(input.description) : undefined }
    )
    return `Created ${created.issueCreate.issue.identifier} — ${created.issueCreate.issue.url}`
  },

  comment: async (input: Record<string, any>): Promise<string> => {
    await linearQuery(
      `mutation($i:String!,$b:String!){commentCreate(input:{issueId:$i,body:$b}){success}}`,
      { i: String(input.issue_id), b: String(input.body) }
    )
    return 'Comment added.'
  }
}

/* ── GitHub ──────────────────────────────────────────────────────────────── */

const github = {
  issues: async (input: Record<string, any>): Promise<string> => {
    const limit = Math.min(Number(input.limit) || 20, 50)
    const data = await call<
      { title: string; html_url: string; repository?: { full_name?: string }; pull_request?: unknown }[]
    >('github', `https://api.github.com/issues?filter=assigned&state=open&per_page=${limit}`)
    return lines(
      data.map(
        (item) =>
          `${item.pull_request ? 'PR' : 'Issue'} · ${item.repository?.full_name ?? ''} — ${item.title}\n    ${item.html_url}`
      ),
      'Nothing assigned to you.'
    )
  },

  repo: async (input: Record<string, any>): Promise<string> => {
    const repo = String(input.repo)
    const [commits, pulls] = await Promise.all([
      call<{ commit: { message: string; author?: { name?: string; date?: string } } }[]>(
        'github',
        `https://api.github.com/repos/${repo}/commits?per_page=10`
      ),
      call<{ title: string; user?: { login?: string }; html_url: string }[]>(
        'github',
        `https://api.github.com/repos/${repo}/pulls?state=open&per_page=10`
      )
    ])
    return [
      `Recent commits in ${repo}:`,
      lines(
        commits.map(
          (entry) =>
            `  · ${entry.commit.message.split('\n')[0]} — ${entry.commit.author?.name ?? '?'} (${entry.commit.author?.date?.slice(0, 10) ?? ''})`
        ),
        '  (none)'
      ),
      '',
      'Open pull requests:',
      lines(pulls.map((pull) => `  · ${pull.title} — @${pull.user?.login ?? '?'}\n    ${pull.html_url}`), '  (none)')
    ].join('\n')
  },

  createIssue: async (input: Record<string, any>): Promise<string> => {
    const issue = await call<{ html_url: string; number: number }>(
      'github',
      `https://api.github.com/repos/${String(input.repo)}/issues`,
      json({ title: String(input.title), body: String(input.body ?? '') })
    )
    return `Opened issue #${issue.number} — ${issue.html_url}`
  }
}

/* ── Todoist ─────────────────────────────────────────────────────────────── */

const todoist = {
  list: async (): Promise<string> => {
    const data = await call<{ id: string; content: string; due?: { string?: string }; priority?: number }[]>(
      'todoist',
      'https://api.todoist.com/rest/v2/tasks'
    )
    return lines(
      data.map((task) => `[${task.id}] ${task.content}${task.due?.string ? ` — due ${task.due.string}` : ''}`),
      'No active tasks.'
    )
  },

  create: async (input: Record<string, any>): Promise<string> => {
    const task = await call<{ id: string }>(
      'todoist',
      'https://api.todoist.com/rest/v2/tasks',
      json({
        content: String(input.content),
        due_string: input.due ? String(input.due) : undefined
      })
    )
    return `Added task ${task.id}.`
  },

  close: async (input: Record<string, any>): Promise<string> => {
    await call('todoist', `https://api.todoist.com/rest/v2/tasks/${String(input.id)}/close`, { method: 'POST' })
    return 'Task completed.'
  }
}

/* ── Registry ────────────────────────────────────────────────────────────── */

export type ActionFn = (input: Record<string, any>) => Promise<string>

export const ACTIONS: Record<string, ActionFn> = {
  'google.gmail_search': gmail.search,
  'google.gmail_read': gmail.read,
  'google.gmail_send': gmail.send,
  'google.gmail_draft': gmail.draft,
  'google.gcal_list': gcal.list,
  'google.gcal_create': gcal.create,

  'microsoft.outlook_search': outlook.search,
  'microsoft.outlook_read': outlook.read,
  'microsoft.outlook_send': outlook.send,
  'microsoft.mscal_list': mscal.list,
  'microsoft.mscal_create': mscal.create,

  'slack.slack_channels': slack.channels,
  'slack.slack_history': slack.history,
  'slack.slack_post': slack.post,

  'linkedin.linkedin_me': linkedin.me,
  'linkedin.linkedin_post': linkedin.post,

  'notion.notion_search': notion.search,
  'notion.notion_read': notion.read,
  'notion.notion_create': notion.create,

  'linear.linear_issues': linear.issues,
  'linear.linear_create': linear.create,
  'linear.linear_comment': linear.comment,

  'github.github_issues': github.issues,
  'github.github_repo': github.repo,
  'github.github_issue_create': github.createIssue,

  'todoist.todoist_list': todoist.list,
  'todoist.todoist_create': todoist.create,
  'todoist.todoist_close': todoist.close
}

/** Resolves the signed-in account so Connections can show who is attached. */
export const identify = async (provider: string): Promise<string> => {
  switch (provider) {
    case 'google': {
      const me = await call<{ email?: string }>('google', 'https://www.googleapis.com/oauth2/v3/userinfo')
      return me.email ?? 'Google account'
    }
    case 'microsoft': {
      const me = await call<{ mail?: string; userPrincipalName?: string }>('microsoft', `${GRAPH}/me`)
      return me.mail ?? me.userPrincipalName ?? 'Microsoft account'
    }
    case 'slack': {
      const me = await call<{ user?: string; team?: string }>('slack', 'https://slack.com/api/auth.test')
      return `${me.user ?? 'user'} @ ${me.team ?? 'workspace'}`
    }
    case 'linkedin': {
      const me = await call<{ name?: string }>('linkedin', 'https://api.linkedin.com/v2/userinfo')
      return me.name ?? 'LinkedIn member'
    }
    case 'notion': {
      const me = await call<{ name?: string; bot?: { owner?: { user?: { name?: string } } } }>(
        'notion',
        'https://api.notion.com/v1/users/me'
      )
      return me.bot?.owner?.user?.name ?? me.name ?? 'Notion integration'
    }
    case 'linear': {
      const data = await linearQuery<{ viewer: { name: string; email: string } }>(`{viewer{name email}}`)
      return data.viewer.email || data.viewer.name
    }
    case 'github': {
      const me = await call<{ login?: string }>('github', 'https://api.github.com/user')
      return me.login ? `@${me.login}` : 'GitHub account'
    }
    case 'todoist': {
      await call('todoist', 'https://api.todoist.com/rest/v2/projects')
      return 'Todoist account'
    }
    default:
      return 'Connected'
  }
}
