import { accessToken } from './oauth'

/* ── HTTP plumbing ───────────────────────────────────────────────────────── */

/**
 * Jira needs three things — site, account email and token — and offers no way
 * to derive the first two from the third, so they travel together in one field
 * separated by pipes.
 */
const jiraParts = (
  token: string
): { site: string; email: string; token: string } => {
  const [site, email, secret] = token.split('|').map((part) => part.trim())
  if (!site || !email || !secret) {
    throw new Error('Jira credential must be "site | email | API token".')
  }
  return { site: site.replace(/\/+$/, ''), email, token: secret }
}

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
    case 'discord':
      // Bot tokens carry their own scheme, not Bearer.
      return { Authorization: `Bot ${token}` }
    case 'brave':
      return { 'X-Subscription-Token': token, Accept: 'application/json' }
    case 'jira': {
      const parts = jiraParts(token)
      const basic = Buffer.from(`${parts.email}:${parts.token}`, 'utf8').toString('base64')
      return { Authorization: `Basic ${basic}`, Accept: 'application/json' }
    }
    case 'telegram':
      // The token is part of the path for every Telegram method.
      return {}
    default:
      return { Authorization: `Bearer ${token}` }
  }
}

/** Resolves a provider-relative path against a credential-derived base URL. */
const baseFor = async (provider: string): Promise<string> => {
  if (provider === 'jira') return `${jiraParts(await accessToken(provider)).site}/rest/api/3`
  if (provider === 'telegram') return `https://api.telegram.org/bot${await accessToken(provider)}`
  return ''
}

const call = async <T>(
  provider: string,
  url: string,
  init: RequestInit = {}
): Promise<T> => {
  const target = url.startsWith('http') ? url : `${await baseFor(provider)}${url}`
  const response = await fetch(target, {
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

const money = (cents: number, currency = 'usd'): string =>
  `${(cents / 100).toLocaleString(undefined, { style: 'currency', currency: currency.toUpperCase() })}`

/** Strips markup and script from fetched HTML so a model sees only the prose. */
export const readable = (html: string): string =>
  html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()

/** Keeps tool results readable and bounded rather than dumping raw payloads. */
const lines = (items: string[], empty: string): string =>
  items.length ? items.join('\n') : empty

export const clip = (text: string, max = 4000): string =>
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

/* ── Google Drive & Sheets ───────────────────────────────────────────────── */

interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  webViewLink?: string
}

/** Google's own formats have to be exported rather than downloaded. */
const EXPORT_AS: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain'
}

const drive = {
  search: async (input: Record<string, any>): Promise<string> => {
    const term = String(input.query ?? '').replace(/'/g, "\\'")
    const params = new URLSearchParams({
      q: `trashed = false and (name contains '${term}' or fullText contains '${term}')`,
      pageSize: String(Math.min(Number(input.limit) || 15, 50)),
      orderBy: 'modifiedTime desc',
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink)'
    })
    const data = await call<{ files?: DriveFile[] }>(
      'google',
      `https://www.googleapis.com/drive/v3/files?${params}`
    )
    return lines(
      (data.files ?? []).map(
        (file) =>
          `[${file.id}] ${file.name} — ${file.mimeType.replace('application/vnd.google-apps.', '')} (modified ${file.modifiedTime?.slice(0, 10) ?? '?'})`
      ),
      'No files matched.'
    )
  },

  read: async (input: Record<string, any>): Promise<string> => {
    const fileId = String(input.id)
    const meta = await call<DriveFile>(
      'google',
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType`
    )
    const exportAs = EXPORT_AS[meta.mimeType]
    const url = exportAs
      ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportAs)}`
      : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`

    // The body is plain text, not JSON, so this one bypasses `call`.
    const response = await fetch(url, { headers: await authHeader('google') })
    if (!response.ok) throw new Error(`Drive ${response.status}: ${await response.text()}`)
    return clip(`${meta.name}\n\n${await response.text()}`, 12000)
  }
}

const sheets = {
  read: async (input: Record<string, any>): Promise<string> => {
    const range = encodeURIComponent(String(input.range ?? 'A1:Z200'))
    const data = await call<{ values?: string[][] }>(
      'google',
      `https://sheets.googleapis.com/v4/spreadsheets/${String(input.id)}/values/${range}`
    )
    const rows = data.values ?? []
    return rows.length
      ? clip(rows.map((row) => row.join('\t')).join('\n'), 12000)
      : 'That range is empty.'
  },

  append: async (input: Record<string, any>): Promise<string> => {
    const range = encodeURIComponent(String(input.range ?? 'A1'))
    const values = Array.isArray(input.values)
      ? (input.values as unknown[]).map(String)
      : String(input.values ?? '').split(',').map((cell) => cell.trim())
    await call(
      'google',
      `https://sheets.googleapis.com/v4/spreadsheets/${String(input.id)}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      json({ values: [values] })
    )
    return `Appended a row of ${values.length} cells.`
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

const onedrive = {
  search: async (input: Record<string, any>): Promise<string> => {
    const term = encodeURIComponent(String(input.query ?? ''))
    const data = await call<{
      value?: { id: string; name: string; lastModifiedDateTime?: string; size?: number }[]
    }>('microsoft', `${GRAPH}/me/drive/root/search(q='${term}')?$top=${Math.min(Number(input.limit) || 15, 50)}`)
    return lines(
      (data.value ?? []).map(
        (file) =>
          `[${file.id}] ${file.name} — ${Math.round((file.size ?? 0) / 1024)} KB (modified ${file.lastModifiedDateTime?.slice(0, 10) ?? '?'})`
      ),
      'No files matched.'
    )
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

  search: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{
      messages?: { matches?: { channel?: { name?: string }; username?: string; text?: string; ts?: string }[] }
    }>(
      'slack',
      `https://slack.com/api/search.messages?query=${encodeURIComponent(String(input.query))}&count=${Math.min(Number(input.limit) || 20, 50)}`
    )
    return lines(
      (data.messages?.matches ?? []).map((match) => {
        const when = match.ts ? new Date(Number(match.ts) * 1000).toLocaleString() : ''
        return `#${match.channel?.name ?? '?'} · ${match.username ?? '?'} (${when}): ${match.text ?? ''}`
      }),
      'Nothing matched.'
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

/* ── Discord ─────────────────────────────────────────────────────────────── */

const DISCORD = 'https://discord.com/api/v10'

const discord = {
  guilds: async (): Promise<string> => {
    const data = await call<{ id: string; name: string }[]>('discord', `${DISCORD}/users/@me/guilds`)
    return lines(
      data.map((guild) => `[${guild.id}] ${guild.name}`),
      'The bot has not been invited to any server yet.'
    )
  },

  channels: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{ id: string; name: string; type: number }[]>(
      'discord',
      `${DISCORD}/guilds/${String(input.guild)}/channels`
    )
    return lines(
      // Type 0 is a plain text channel; the rest are voice, categories, forums.
      data.filter((channel) => channel.type === 0).map((channel) => `[${channel.id}] #${channel.name}`),
      'No text channels visible to the bot.'
    )
  },

  history: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{ author?: { username?: string }; content?: string; timestamp?: string }[]>(
      'discord',
      `${DISCORD}/channels/${String(input.channel)}/messages?limit=${Math.min(Number(input.limit) || 25, 100)}`
    )
    return lines(
      data
        .slice()
        .reverse()
        .map(
          (message) =>
            `${message.timestamp ? new Date(message.timestamp).toLocaleString() : ''} ${message.author?.username ?? '?'}: ${message.content ?? ''}`
        ),
      'No messages in that channel.'
    )
  },

  post: async (input: Record<string, any>): Promise<string> => {
    await call(
      'discord',
      `${DISCORD}/channels/${String(input.channel)}/messages`,
      json({ content: String(input.text) })
    )
    return 'Posted to Discord.'
  }
}

/* ── Telegram ────────────────────────────────────────────────────────────── */

const telegram = {
  updates: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{
      result?: { message?: { chat?: { id: number; title?: string; username?: string }; from?: { username?: string }; text?: string; date?: number } }[]
    }>('telegram', `/getUpdates?limit=${Math.min(Number(input.limit) || 20, 100)}`)
    return lines(
      (data.result ?? [])
        .map((update) => update.message)
        .filter((message): message is NonNullable<typeof message> => Boolean(message))
        .map((message) => {
          const when = message.date ? new Date(message.date * 1000).toLocaleString() : ''
          const chat = message.chat?.title ?? message.chat?.username ?? message.chat?.id
          return `[chat ${message.chat?.id}] ${chat} · ${message.from?.username ?? '?'} (${when}): ${message.text ?? ''}`
        }),
      'No recent messages. Send your bot a message first — Telegram only queues what arrives after the bot exists.'
    )
  },

  send: async (input: Record<string, any>): Promise<string> => {
    await call('telegram', '/sendMessage', json({ chat_id: String(input.chat), text: String(input.text) }))
    return `Sent to chat ${String(input.chat)}.`
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

  query: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{ results?: NotionResult[] }>(
      'notion',
      `https://api.notion.com/v1/databases/${String(input.database_id)}/query`,
      json({ page_size: Math.min(Number(input.limit) || 25, 100) })
    )
    return lines(
      (data.results ?? []).map((row) => {
        const fields = Object.entries(row.properties ?? {})
          .map(([key, property]) => {
            const value = property as Record<string, any>
            const text =
              value.title?.map((part: any) => part.plain_text).join('') ??
              value.rich_text?.map((part: any) => part.plain_text).join('') ??
              value.select?.name ??
              value.status?.name ??
              value.number ??
              value.date?.start ??
              value.checkbox
            return text === undefined || text === '' ? null : `${key}: ${String(text)}`
          })
          .filter(Boolean)
        return `[${row.id}] ${fields.join(' · ')}`
      }),
      'That database returned no rows.'
    )
  },

  append: async (input: Record<string, any>): Promise<string> => {
    const blocks = String(input.body ?? '')
      .split('\n')
      .filter(Boolean)
      .map((line) => ({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: line } }] }
      }))
    await call('notion', `https://api.notion.com/v1/blocks/${String(input.id)}/children`, {
      method: 'PATCH',
      body: JSON.stringify({ children: blocks })
    })
    return `Appended ${blocks.length} paragraph(s).`
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

  search: async (input: Record<string, any>): Promise<string> => {
    const data = await linearQuery<{
      searchIssues: { nodes: { identifier: string; title: string; state: { name: string }; url: string }[] }
    }>(`query($q:String!,$n:Int!){searchIssues(term:$q,first:$n){nodes{identifier title state{name} url}}}`, {
      q: String(input.query),
      n: Math.min(Number(input.limit) || 20, 50)
    })
    return lines(
      data.searchIssues.nodes.map((issue) => `${issue.identifier} [${issue.state.name}] ${issue.title}`),
      'Nothing matched.'
    )
  },

  comment: async (input: Record<string, any>): Promise<string> => {
    await linearQuery(
      `mutation($i:String!,$b:String!){commentCreate(input:{issueId:$i,body:$b}){success}}`,
      { i: String(input.issue_id), b: String(input.body) }
    )
    return 'Comment added.'
  },

  update: async (input: Record<string, any>): Promise<string> => {
    const wanted = String(input.state).toLowerCase()
    const data = await linearQuery<{
      issue: { id: string; team: { states: { nodes: { id: string; name: string }[] } } }
    }>(`query($id:String!){issue(id:$id){id team{states{nodes{id name}}}}}`, {
      id: String(input.issue_id)
    })
    const state = data.issue.team.states.nodes.find(
      (candidate) => candidate.name.toLowerCase() === wanted
    )
    if (!state) {
      const available = data.issue.team.states.nodes.map((node) => node.name).join(', ')
      return `No state called "${String(input.state)}". This team has: ${available}.`
    }
    await linearQuery(
      `mutation($i:String!,$s:String!){issueUpdate(id:$i,input:{stateId:$s}){success}}`,
      { i: data.issue.id, s: state.id }
    )
    return `Moved to ${state.name}.`
  }
}

/* ── Asana ───────────────────────────────────────────────────────────────── */

const ASANA = 'https://app.asana.com/api/1.0'

/** Most Asana reads are workspace-scoped, and the token knows its own. */
const asanaWorkspace = async (given?: unknown): Promise<string> => {
  if (given) return String(given)
  const me = await call<{ data?: { workspaces?: { gid: string; name: string }[] } }>(
    'asana',
    `${ASANA}/users/me`
  )
  const workspace = me.data?.workspaces?.[0]
  if (!workspace) throw new Error('This Asana token has no workspace.')
  return workspace.gid
}

const asana = {
  tasks: async (input: Record<string, any>): Promise<string> => {
    const workspace = await asanaWorkspace(input.workspace)
    const data = await call<{
      data?: { gid: string; name: string; due_on?: string; completed?: boolean }[]
    }>(
      'asana',
      `${ASANA}/tasks?assignee=me&workspace=${workspace}&completed_since=now&opt_fields=name,due_on,completed&limit=${Math.min(Number(input.limit) || 25, 100)}`
    )
    return lines(
      (data.data ?? [])
        .filter((task) => !task.completed)
        .map((task) => `[${task.gid}] ${task.name}${task.due_on ? ` — due ${task.due_on}` : ''}`),
      'No incomplete tasks assigned to you.'
    )
  },

  projects: async (input: Record<string, any>): Promise<string> => {
    const workspace = await asanaWorkspace(input.workspace)
    const data = await call<{ data?: { gid: string; name: string }[] }>(
      'asana',
      `${ASANA}/projects?workspace=${workspace}&archived=false&limit=100`
    )
    return lines(
      (data.data ?? []).map((project) => `[${project.gid}] ${project.name}`),
      'No projects in this workspace.'
    )
  },

  create: async (input: Record<string, any>): Promise<string> => {
    const workspace = await asanaWorkspace(input.workspace)
    const task = await call<{ data?: { gid: string; permalink_url?: string } }>(
      'asana',
      `${ASANA}/tasks`,
      json({
        data: {
          name: String(input.name),
          notes: input.notes ? String(input.notes) : undefined,
          due_on: input.due ? String(input.due) : undefined,
          assignee: 'me',
          workspace,
          projects: input.project ? [String(input.project)] : undefined
        }
      })
    )
    return `Created task ${task.data?.gid ?? ''}.`
  },

  complete: async (input: Record<string, any>): Promise<string> => {
    await call('asana', `${ASANA}/tasks/${String(input.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ data: { completed: true } })
    })
    return 'Task completed.'
  }
}

/* ── Jira ────────────────────────────────────────────────────────────────── */

interface JiraIssue {
  key: string
  fields?: {
    summary?: string
    status?: { name?: string }
    assignee?: { displayName?: string }
    description?: unknown
  }
}

/** Jira Cloud returns Atlassian Document Format, not text. Flatten it. */
const adfText = (node: any): string => {
  if (!node || typeof node !== 'object') return ''
  if (node.type === 'text') return String(node.text ?? '')
  return (node.content ?? []).map(adfText).join(node.type === 'paragraph' ? '' : ' ')
}

const jira = {
  search: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{ issues?: JiraIssue[] }>(
      'jira',
      `/search/jql?jql=${encodeURIComponent(String(input.jql ?? 'assignee = currentUser() AND statusCategory != Done'))}&maxResults=${Math.min(Number(input.limit) || 25, 50)}&fields=summary,status,assignee`
    )
    return lines(
      (data.issues ?? []).map(
        (issue) =>
          `${issue.key} [${issue.fields?.status?.name ?? '?'}] ${issue.fields?.summary ?? ''} — ${issue.fields?.assignee?.displayName ?? 'unassigned'}`
      ),
      'No issues matched that query.'
    )
  },

  read: async (input: Record<string, any>): Promise<string> => {
    const issue = await call<JiraIssue>('jira', `/issue/${String(input.key)}`)
    return clip(
      `${issue.key} — ${issue.fields?.summary ?? ''}\nStatus: ${issue.fields?.status?.name ?? '?'}\nAssignee: ${issue.fields?.assignee?.displayName ?? 'unassigned'}\n\n${adfText(issue.fields?.description) || '(no description)'}`
    )
  },

  create: async (input: Record<string, any>): Promise<string> => {
    const issue = await call<{ key: string }>(
      'jira',
      '/issue',
      json({
        fields: {
          project: { key: String(input.project) },
          summary: String(input.summary),
          issuetype: { name: String(input.type ?? 'Task') },
          description: {
            type: 'doc',
            version: 1,
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: String(input.description ?? '') }] }
            ]
          }
        }
      })
    )
    return `Created ${issue.key}.`
  },

  comment: async (input: Record<string, any>): Promise<string> => {
    await call(
      'jira',
      `/issue/${String(input.key)}/comment`,
      json({
        body: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: String(input.body) }] }]
        }
      })
    )
    return `Commented on ${String(input.key)}.`
  }
}

/* ── Airtable ────────────────────────────────────────────────────────────── */

const airtable = {
  bases: async (): Promise<string> => {
    const data = await call<{ bases?: { id: string; name: string }[] }>(
      'airtable',
      'https://api.airtable.com/v0/meta/bases'
    )
    const described = await Promise.all(
      (data.bases ?? []).map(async (base) => {
        try {
          const schema = await call<{ tables?: { id: string; name: string }[] }>(
            'airtable',
            `https://api.airtable.com/v0/meta/bases/${base.id}/tables`
          )
          const tables = (schema.tables ?? []).map((table) => table.name).join(', ')
          return `[${base.id}] ${base.name} — tables: ${tables || '(none visible)'}`
        } catch {
          // The token may reach a base's records without its schema.
          return `[${base.id}] ${base.name}`
        }
      })
    )
    return lines(described, 'This token can reach no bases. Grant it access in Airtable.')
  },

  records: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{ records?: { id: string; fields: Record<string, unknown> }[] }>(
      'airtable',
      `https://api.airtable.com/v0/${String(input.base)}/${encodeURIComponent(String(input.table))}?maxRecords=${Math.min(Number(input.limit) || 25, 100)}`
    )
    return lines(
      (data.records ?? []).map(
        (record) =>
          `[${record.id}] ${Object.entries(record.fields)
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join(' · ')}`
      ),
      'That table is empty.'
    )
  },

  create: async (input: Record<string, any>): Promise<string> => {
    const fields =
      typeof input.fields === 'string'
        ? (JSON.parse(input.fields) as Record<string, unknown>)
        : ((input.fields ?? {}) as Record<string, unknown>)
    const record = await call<{ id: string }>(
      'airtable',
      `https://api.airtable.com/v0/${String(input.base)}/${encodeURIComponent(String(input.table))}`,
      json({ fields })
    )
    return `Created record ${record.id}.`
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

  search: async (input: Record<string, any>): Promise<string> => {
    const scope = input.repo ? ` repo:${String(input.repo)}` : ''
    const data = await call<{
      items?: { name: string; path: string; repository?: { full_name?: string }; html_url: string }[]
    }>(
      'github',
      `https://api.github.com/search/code?q=${encodeURIComponent(String(input.query) + scope)}&per_page=${Math.min(Number(input.limit) || 15, 30)}`
    )
    return lines(
      (data.items ?? []).map(
        (item) => `${item.repository?.full_name ?? ''}/${item.path}\n    ${item.html_url}`
      ),
      'No code matched.'
    )
  },

  createIssue: async (input: Record<string, any>): Promise<string> => {
    const issue = await call<{ html_url: string; number: number }>(
      'github',
      `https://api.github.com/repos/${String(input.repo)}/issues`,
      json({ title: String(input.title), body: String(input.body ?? '') })
    )
    return `Opened issue #${issue.number} — ${issue.html_url}`
  },

  comment: async (input: Record<string, any>): Promise<string> => {
    const comment = await call<{ html_url: string }>(
      'github',
      `https://api.github.com/repos/${String(input.repo)}/issues/${String(input.number)}/comments`,
      json({ body: String(input.body) })
    )
    return `Commented — ${comment.html_url}`
  }
}

/* ── Vercel ──────────────────────────────────────────────────────────────── */

const vercel = {
  projects: async (): Promise<string> => {
    const data = await call<{ projects?: { id: string; name: string; framework?: string; updatedAt?: number }[] }>(
      'vercel',
      'https://api.vercel.com/v9/projects?limit=50'
    )
    return lines(
      (data.projects ?? []).map(
        (project) =>
          `[${project.id}] ${project.name}${project.framework ? ` · ${project.framework}` : ''}`
      ),
      'No projects on this account.'
    )
  },

  deployments: async (input: Record<string, any>): Promise<string> => {
    const app = input.project ? `&app=${encodeURIComponent(String(input.project))}` : ''
    const data = await call<{
      deployments?: { uid: string; name: string; url: string; state?: string; created?: number; target?: string }[]
    }>('vercel', `https://api.vercel.com/v6/deployments?limit=${Math.min(Number(input.limit) || 15, 50)}${app}`)
    return lines(
      (data.deployments ?? []).map(
        (deployment) =>
          `${deployment.state ?? '?'} · ${deployment.name} (${deployment.target ?? 'preview'}) — https://${deployment.url} — ${deployment.created ? new Date(deployment.created).toLocaleString() : ''}`
      ),
      'No deployments yet.'
    )
  }
}

/* ── Sentry ──────────────────────────────────────────────────────────────── */

const SENTRY = 'https://sentry.io/api/0'

const sentry = {
  projects: async (): Promise<string> => {
    const data = await call<{ slug: string; name: string; organization?: { slug?: string } }[]>(
      'sentry',
      `${SENTRY}/projects/`
    )
    return lines(
      data.map((project) => `${project.organization?.slug ?? '?'}/${project.slug} — ${project.name}`),
      'This token can see no projects.'
    )
  },

  issues: async (input: Record<string, any>): Promise<string> => {
    // Fall back to the first visible project so the agent need not know slugs.
    let org = input.org ? String(input.org) : ''
    let project = input.project ? String(input.project) : ''
    if (!org || !project) {
      const projects = await call<{ slug: string; organization?: { slug?: string } }[]>(
        'sentry',
        `${SENTRY}/projects/`
      )
      const first = projects[0]
      if (!first) return 'This token can see no projects.'
      org = org || first.organization?.slug || ''
      project = project || first.slug
    }
    const data = await call<
      { shortId: string; title: string; count?: string; userCount?: number; lastSeen?: string; permalink?: string }[]
    >(
      'sentry',
      `${SENTRY}/projects/${org}/${project}/issues/?query=is:unresolved&statsPeriod=14d&limit=${Math.min(Number(input.limit) || 15, 50)}`
    )
    return lines(
      data.map(
        (issue) =>
          `${issue.shortId} · ${issue.title}\n    ${issue.count ?? 0} events, ${issue.userCount ?? 0} users, last ${issue.lastSeen?.slice(0, 10) ?? '?'}`
      ),
      `Nothing unresolved in ${org}/${project}.`
    )
  }
}

/* ── Stripe ──────────────────────────────────────────────────────────────── */

const STRIPE = 'https://api.stripe.com/v1'

const stripe = {
  balance: async (): Promise<string> => {
    const data = await call<{
      available?: { amount: number; currency: string }[]
      pending?: { amount: number; currency: string }[]
    }>('stripe', `${STRIPE}/balance`)
    const show = (entries: { amount: number; currency: string }[] = []): string =>
      entries.map((entry) => money(entry.amount, entry.currency)).join(', ') || 'nothing'
    return `Available: ${show(data.available)}\nPending: ${show(data.pending)}`
  },

  revenue: async (input: Record<string, any>): Promise<string> => {
    const days = Math.min(Number(input.days) || 30, 365)
    const since = Math.floor((Date.now() - days * 864e5) / 1000)
    const data = await call<{
      data?: { amount: number; currency: string; paid: boolean; refunded: boolean; created: number }[]
    }>('stripe', `${STRIPE}/charges?limit=100&created[gte]=${since}`)
    const charges = (data.data ?? []).filter((charge) => charge.paid && !charge.refunded)
    const total = charges.reduce((sum, charge) => sum + charge.amount, 0)
    const currency = charges[0]?.currency ?? 'usd'
    return [
      `${charges.length} successful charges in the last ${days} days.`,
      `Gross: ${money(total, currency)}`,
      charges.length ? `Average: ${money(Math.round(total / charges.length), currency)}` : '',
      charges.length === 100 ? '(capped at Stripe’s 100-record page — the real figure is higher)' : ''
    ]
      .filter(Boolean)
      .join('\n')
  },

  subscriptions: async (): Promise<string> => {
    const data = await call<{
      data?: {
        id: string
        status: string
        customer: string
        items?: { data?: { price?: { unit_amount?: number; currency?: string; recurring?: { interval?: string } } }[] }
      }[]
    }>('stripe', `${STRIPE}/subscriptions?status=active&limit=100`)
    const subscriptions = data.data ?? []
    let monthly = 0
    let currency = 'usd'
    for (const subscription of subscriptions) {
      for (const item of subscription.items?.data ?? []) {
        const amount = item.price?.unit_amount ?? 0
        currency = item.price?.currency ?? currency
        // Normalise everything to a monthly figure so the total means something.
        monthly += item.price?.recurring?.interval === 'year' ? amount / 12 : amount
      }
    }
    return [
      `${subscriptions.length} active subscriptions.`,
      `Monthly recurring revenue: ${money(Math.round(monthly), currency)}`
    ].join('\n')
  },

  customers: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{ data?: { id: string; email?: string; name?: string; created: number }[] }>(
      'stripe',
      `${STRIPE}/customers?limit=${Math.min(Number(input.limit) || 20, 100)}`
    )
    return lines(
      (data.data ?? []).map(
        (customer) =>
          `[${customer.id}] ${customer.name ?? customer.email ?? 'unnamed'} — joined ${new Date(customer.created * 1000).toLocaleDateString()}`
      ),
      'No customers yet.'
    )
  }
}

/* ── HubSpot ─────────────────────────────────────────────────────────────── */

const HUBSPOT = 'https://api.hubapi.com'

interface HubSpotObject {
  id: string
  properties: Record<string, string | null>
}

const hubspot = {
  contacts: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{ results?: HubSpotObject[] }>(
      'hubspot',
      `${HUBSPOT}/crm/v3/objects/contacts?limit=${Math.min(Number(input.limit) || 25, 100)}&properties=firstname,lastname,email,company,lifecyclestage`
    )
    return lines(
      (data.results ?? []).map((contact) => {
        const p = contact.properties
        const name = [p['firstname'], p['lastname']].filter(Boolean).join(' ') || '(no name)'
        return `[${contact.id}] ${name} <${p['email'] ?? '?'}>${p['company'] ? ` · ${p['company']}` : ''}${p['lifecyclestage'] ? ` · ${p['lifecyclestage']}` : ''}`
      }),
      'No contacts.'
    )
  },

  deals: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{ results?: HubSpotObject[] }>(
      'hubspot',
      `${HUBSPOT}/crm/v3/objects/deals?limit=${Math.min(Number(input.limit) || 25, 100)}&properties=dealname,amount,dealstage,closedate`
    )
    return lines(
      (data.results ?? []).map((deal) => {
        const p = deal.properties
        return `[${deal.id}] ${p['dealname'] ?? '(unnamed)'} — ${p['amount'] ?? '?'} · ${p['dealstage'] ?? '?'}${p['closedate'] ? ` · closes ${p['closedate'].slice(0, 10)}` : ''}`
      }),
      'No deals.'
    )
  },

  search: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{ results?: HubSpotObject[] }>(
      'hubspot',
      `${HUBSPOT}/crm/v3/objects/contacts/search`,
      json({
        query: String(input.query),
        limit: Math.min(Number(input.limit) || 10, 50),
        properties: ['firstname', 'lastname', 'email', 'company']
      })
    )
    return lines(
      (data.results ?? []).map((contact) => {
        const p = contact.properties
        return `[${contact.id}] ${[p['firstname'], p['lastname']].filter(Boolean).join(' ')} <${p['email'] ?? '?'}>`
      }),
      'Nothing matched.'
    )
  },

  note: async (input: Record<string, any>): Promise<string> => {
    await call(
      'hubspot',
      `${HUBSPOT}/crm/v3/objects/notes`,
      json({
        properties: { hs_note_body: String(input.body), hs_timestamp: new Date().toISOString() },
        // Association type 202 is note-to-contact in HubSpot's v4 taxonomy.
        associations: [
          {
            to: { id: String(input.contact_id) },
            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }]
          }
        ]
      })
    )
    return `Note logged against contact ${String(input.contact_id)}.`
  }
}

/* ── Calendly ────────────────────────────────────────────────────────────── */

const CALENDLY = 'https://api.calendly.com'

const calendlyMe = async (): Promise<{ uri: string; name?: string; email?: string }> => {
  const me = await call<{ resource?: { uri: string; name?: string; email?: string } }>(
    'calendly',
    `${CALENDLY}/users/me`
  )
  if (!me.resource) throw new Error('Calendly did not return your user.')
  return me.resource
}

const calendly = {
  events: async (input: Record<string, any>): Promise<string> => {
    const me = await calendlyMe()
    const days = Math.min(Number(input.days) || 14, 90)
    const params = new URLSearchParams({
      user: me.uri,
      min_start_time: new Date().toISOString(),
      max_start_time: new Date(Date.now() + days * 864e5).toISOString(),
      status: 'active',
      count: '50'
    })
    const data = await call<{
      collection?: { name: string; start_time: string; end_time: string; location?: { join_url?: string } }[]
    }>('calendly', `${CALENDLY}/scheduled_events?${params}`)
    return lines(
      (data.collection ?? []).map(
        (event) =>
          `${new Date(event.start_time).toLocaleString()} — ${event.name}${event.location?.join_url ? `\n    ${event.location.join_url}` : ''}`
      ),
      `Nothing booked in the next ${days} days.`
    )
  },

  types: async (): Promise<string> => {
    const me = await calendlyMe()
    const data = await call<{
      collection?: { name: string; duration: number; scheduling_url: string; active: boolean }[]
    }>('calendly', `${CALENDLY}/event_types?user=${encodeURIComponent(me.uri)}&active=true&count=50`)
    return lines(
      (data.collection ?? []).map(
        (type) => `${type.name} — ${type.duration} min\n    ${type.scheduling_url}`
      ),
      'No active event types.'
    )
  }
}

/* ── X ───────────────────────────────────────────────────────────────────── */

const x = {
  me: async (): Promise<string> => {
    const data = await call<{ data?: { id: string; name?: string; username?: string } }>(
      'x',
      'https://api.x.com/2/users/me'
    )
    return `${data.data?.name ?? 'Unknown'} (@${data.data?.username ?? '?'}, id ${data.data?.id ?? '?'})`
  },

  post: async (input: Record<string, any>): Promise<string> => {
    const text = String(input.text)
    if (text.length > 280) throw new Error(`That post is ${text.length} characters; the limit is 280.`)
    const data = await call<{ data?: { id: string } }>(
      'x',
      'https://api.x.com/2/tweets',
      json({ text })
    )
    return `Posted — https://x.com/i/status/${data.data?.id ?? ''}`
  }
}

/* ── Brave Search ────────────────────────────────────────────────────────── */

const brave = {
  web: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{
      web?: { results?: { title: string; url: string; description?: string; age?: string }[] }
    }>(
      'brave',
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(String(input.query))}&count=${Math.min(Number(input.limit) || 8, 20)}`
    )
    return lines(
      (data.web?.results ?? []).map(
        (result) =>
          `${result.title}${result.age ? ` (${result.age})` : ''}\n    ${result.url}\n    ${readable(result.description ?? '')}`
      ),
      'No results.'
    )
  },

  news: async (input: Record<string, any>): Promise<string> => {
    const data = await call<{
      results?: { title: string; url: string; description?: string; age?: string; source?: string }[]
    }>(
      'brave',
      `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(String(input.query))}&count=${Math.min(Number(input.limit) || 8, 20)}`
    )
    return lines(
      (data.results ?? []).map(
        (result) =>
          `${result.title} — ${result.source ?? '?'}${result.age ? `, ${result.age}` : ''}\n    ${result.url}\n    ${readable(result.description ?? '')}`
      ),
      'No news found.'
    )
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
  'google.drive_search': drive.search,
  'google.drive_read': drive.read,
  'google.sheets_read': sheets.read,
  'google.sheets_append': sheets.append,

  'microsoft.outlook_search': outlook.search,
  'microsoft.outlook_read': outlook.read,
  'microsoft.outlook_send': outlook.send,
  'microsoft.mscal_list': mscal.list,
  'microsoft.mscal_create': mscal.create,
  'microsoft.onedrive_search': onedrive.search,

  'slack.slack_channels': slack.channels,
  'slack.slack_history': slack.history,
  'slack.slack_search': slack.search,
  'slack.slack_post': slack.post,

  'discord.discord_guilds': discord.guilds,
  'discord.discord_channels': discord.channels,
  'discord.discord_history': discord.history,
  'discord.discord_post': discord.post,

  'telegram.telegram_updates': telegram.updates,
  'telegram.telegram_send': telegram.send,

  'linkedin.linkedin_me': linkedin.me,
  'linkedin.linkedin_post': linkedin.post,

  'x.x_me': x.me,
  'x.x_post': x.post,

  'notion.notion_search': notion.search,
  'notion.notion_read': notion.read,
  'notion.notion_query': notion.query,
  'notion.notion_create': notion.create,
  'notion.notion_append': notion.append,

  'linear.linear_issues': linear.issues,
  'linear.linear_search': linear.search,
  'linear.linear_create': linear.create,
  'linear.linear_comment': linear.comment,
  'linear.linear_update': linear.update,

  'asana.asana_tasks': asana.tasks,
  'asana.asana_projects': asana.projects,
  'asana.asana_create': asana.create,
  'asana.asana_complete': asana.complete,

  'jira.jira_search': jira.search,
  'jira.jira_read': jira.read,
  'jira.jira_create': jira.create,
  'jira.jira_comment': jira.comment,

  'airtable.airtable_bases': airtable.bases,
  'airtable.airtable_records': airtable.records,
  'airtable.airtable_create': airtable.create,

  'github.github_issues': github.issues,
  'github.github_repo': github.repo,
  'github.github_search': github.search,
  'github.github_issue_create': github.createIssue,
  'github.github_comment': github.comment,

  'vercel.vercel_projects': vercel.projects,
  'vercel.vercel_deployments': vercel.deployments,

  'sentry.sentry_issues': sentry.issues,
  'sentry.sentry_projects': sentry.projects,

  'stripe.stripe_balance': stripe.balance,
  'stripe.stripe_revenue': stripe.revenue,
  'stripe.stripe_subscriptions': stripe.subscriptions,
  'stripe.stripe_customers': stripe.customers,

  'hubspot.hubspot_contacts': hubspot.contacts,
  'hubspot.hubspot_deals': hubspot.deals,
  'hubspot.hubspot_search': hubspot.search,
  'hubspot.hubspot_note': hubspot.note,

  'calendly.calendly_events': calendly.events,
  'calendly.calendly_types': calendly.types,

  'brave.brave_search': brave.web,
  'brave.brave_news': brave.news,

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
    case 'discord': {
      const me = await call<{ username?: string }>('discord', `${DISCORD}/users/@me`)
      return me.username ? `${me.username} (bot)` : 'Discord bot'
    }
    case 'telegram': {
      const me = await call<{ result?: { username?: string } }>('telegram', '/getMe')
      return me.result?.username ? `@${me.result.username}` : 'Telegram bot'
    }
    case 'asana': {
      const me = await call<{ data?: { email?: string; name?: string } }>('asana', `${ASANA}/users/me`)
      return me.data?.email ?? me.data?.name ?? 'Asana account'
    }
    case 'jira': {
      const me = await call<{ emailAddress?: string; displayName?: string }>('jira', '/myself')
      return me.emailAddress ?? me.displayName ?? 'Jira account'
    }
    case 'airtable': {
      const me = await call<{ id?: string; email?: string }>(
        'airtable',
        'https://api.airtable.com/v0/meta/whoami'
      )
      return me.email ?? me.id ?? 'Airtable token'
    }
    case 'vercel': {
      const me = await call<{ user?: { username?: string; email?: string } }>(
        'vercel',
        'https://api.vercel.com/v2/user'
      )
      return me.user?.username ?? me.user?.email ?? 'Vercel account'
    }
    case 'sentry': {
      const orgs = await call<{ slug: string }[]>('sentry', `${SENTRY}/organizations/`)
      return orgs[0]?.slug ? `org ${orgs[0].slug}` : 'Sentry token'
    }
    case 'stripe': {
      const account = await call<{ business_profile?: { name?: string }; id?: string }>(
        'stripe',
        `${STRIPE}/account`
      )
      return account.business_profile?.name ?? account.id ?? 'Stripe account'
    }
    case 'hubspot': {
      // The token-info endpoint is the only one that works for every scope set.
      const info = await call<{ hub_domain?: string; user?: string }>(
        'hubspot',
        `${HUBSPOT}/oauth/v1/access-tokens/${await accessToken('hubspot')}`
      )
      return info.user ?? info.hub_domain ?? 'HubSpot account'
    }
    case 'calendly': {
      const me = await calendlyMe()
      return me.email ?? me.name ?? 'Calendly account'
    }
    case 'x': {
      const me = await call<{ data?: { username?: string } }>('x', 'https://api.x.com/2/users/me')
      return me.data?.username ? `@${me.data.username}` : 'X account'
    }
    case 'brave': {
      await call('brave', 'https://api.search.brave.com/res/v1/web/search?q=grove&count=1')
      return 'Brave Search key'
    }
    default:
      return 'Connected'
  }
}
