import { lit, osa } from './osa'

/**
 * Native Apple app access.
 *
 * These talk to Calendar, Reminders, Notes and Mail on this Mac through
 * scripting — no OAuth, no cloud round trip, and they work against whatever
 * accounts are already signed in. This is the part a browser tab cannot do.
 */

const clip = (text: string, max = 4000): string =>
  text.length > max ? `${text.slice(0, max)}\n…[truncated]` : text

const lines = (items: string[], empty: string): string => (items.length ? items.join('\n') : empty)

/* ── Calendar ────────────────────────────────────────────────────────────── */

interface RawEvent {
  id: string
  title: string
  start: string
  end: string
  calendar: string
  location: string
}

export const calendarList = async (input: Record<string, any>): Promise<string> => {
  const days = Math.min(Number(input.days) || 1, 30)
  const events = await osa<RawEvent[]>(`
    const app = Application('Calendar')
    app.includeStandardAdditions = true
    const from = new Date()
    const to = new Date(Date.now() + ${days} * 86400000)
    const out = []
    for (const cal of app.calendars()) {
      let found
      try {
        found = cal.events.whose({ _and: [{ startDate: { _greaterThan: from } }, { startDate: { _lessThan: to } }] })()
      } catch (e) { continue }
      for (const event of found) {
        out.push({
          id: String(event.uid()),
          title: String(event.summary()),
          start: event.startDate().toISOString(),
          end: event.endDate().toISOString(),
          calendar: String(cal.name()),
          location: String(event.location() || '')
        })
      }
    }
    out.sort((a, b) => a.start.localeCompare(b.start))
    JSON.stringify(out.slice(0, 60))
  `)

  return lines(
    (events ?? []).map((event) => {
      const when = new Date(event.start).toLocaleString(undefined, {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit'
      })
      const minutes = Math.round(
        (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
      )
      return `[${event.id}] ${when} (${minutes}m) — ${event.title}${event.location ? ` @ ${event.location}` : ''} · ${event.calendar}`
    }),
    `Nothing on the calendar for the next ${days} day(s).`
  )
}

export const calendarCreate = async (input: Record<string, any>): Promise<string> => {
  const start = new Date(String(input.start))
  if (Number.isNaN(start.getTime())) throw new Error('Could not read that start time.')
  const end = input.end ? new Date(String(input.end)) : new Date(start.getTime() + 3600000)

  await osa(`
    const app = Application('Calendar')
    const target = app.calendars.whose({ name: ${lit(input.calendar || '')} })().length && ${lit(input.calendar || '')} !== ''
      ? app.calendars.whose({ name: ${lit(input.calendar || '')} })()[0]
      : app.defaultCalendar()
    const event = app.Event({
      summary: ${lit(input.title ?? 'Untitled')},
      startDate: new Date(${start.getTime()}),
      endDate: new Date(${end.getTime()}),
      description: ${lit(input.description ?? '')},
      location: ${lit(input.location ?? '')}
    })
    target.events.push(event)
    'ok'
  `)

  return `Added "${String(input.title)}" to Calendar on ${start.toLocaleString()}.`
}

/* ── Reminders ───────────────────────────────────────────────────────────── */

interface RawReminder {
  id: string
  name: string
  due: string | null
  list: string
}

export const remindersList = async (input: Record<string, any>): Promise<string> => {
  const reminders = await osa<RawReminder[]>(`
    const app = Application('Reminders')
    const out = []
    for (const list of app.lists()) {
      for (const item of list.reminders.whose({ completed: false })()) {
        const due = item.dueDate()
        out.push({
          id: String(item.id()),
          name: String(item.name()),
          due: due ? due.toISOString() : null,
          list: String(list.name())
        })
      }
    }
    JSON.stringify(out.slice(0, 100))
  `)

  const filtered = input.list
    ? (reminders ?? []).filter((item) => item.list.toLowerCase() === String(input.list).toLowerCase())
    : (reminders ?? [])

  return lines(
    filtered.map(
      (item) =>
        `[${item.id}] ${item.name}${item.due ? ` — due ${new Date(item.due).toLocaleString()}` : ''} · ${item.list}`
    ),
    'No open reminders.'
  )
}

export const remindersCreate = async (input: Record<string, any>): Promise<string> => {
  const due = input.due ? new Date(String(input.due)) : null
  await osa(`
    const app = Application('Reminders')
    const listName = ${lit(input.list ?? '')}
    const list = listName && app.lists.whose({ name: listName })().length
      ? app.lists.whose({ name: listName })()[0]
      : app.defaultList()
    const reminder = app.Reminder({
      name: ${lit(input.title)},
      body: ${lit(input.notes ?? '')}${due && !Number.isNaN(due.getTime()) ? `,\n      dueDate: new Date(${due.getTime()})` : ''}
    })
    list.reminders.push(reminder)
    'ok'
  `)
  return `Added reminder "${String(input.title)}"${due ? ` for ${due.toLocaleString()}` : ''}.`
}

export const remindersComplete = async (input: Record<string, any>): Promise<string> => {
  await osa(`
    const app = Application('Reminders')
    const needle = ${lit(input.title)}.toLowerCase()
    for (const list of app.lists()) {
      for (const item of list.reminders.whose({ completed: false })()) {
        if (String(item.id()) === ${lit(input.title)} || String(item.name()).toLowerCase().indexOf(needle) !== -1) {
          item.completed = true
          throw new Error('DONE:' + item.name())
        }
      }
    }
    'none'
  `).catch((error: Error) => {
    // The throw is how the loop reports which reminder it closed.
    if (!error.message.includes('DONE:')) throw error
  })
  return `Completed reminder "${String(input.title)}".`
}

/* ── Notes ───────────────────────────────────────────────────────────────── */

export const notesSearch = async (input: Record<string, any>): Promise<string> => {
  const notes = await osa<{ id: string; name: string; preview: string }[]>(`
    const app = Application('Notes')
    const needle = ${lit(input.query ?? '')}.toLowerCase()
    const out = []
    for (const note of app.notes()) {
      const name = String(note.name())
      const body = String(note.plaintext())
      if (!needle || name.toLowerCase().indexOf(needle) !== -1 || body.toLowerCase().indexOf(needle) !== -1) {
        out.push({ id: String(note.id()), name: name, preview: body.slice(0, 180) })
      }
      if (out.length >= 20) break
    }
    JSON.stringify(out)
  `)

  return lines(
    (notes ?? []).map((note) => `[${note.id}] ${note.name}\n    ${note.preview.replace(/\n/g, ' ')}`),
    'No notes matched.'
  )
}

export const notesRead = async (input: Record<string, any>): Promise<string> => {
  const body = await osa<string>(`
    const app = Application('Notes')
    const needle = ${lit(input.note)}.toLowerCase()
    for (const note of app.notes()) {
      if (String(note.id()) === ${lit(input.note)} || String(note.name()).toLowerCase().indexOf(needle) !== -1) {
        JSON.stringify(String(note.name()) + '\\n\\n' + String(note.plaintext()))
        break
      }
    }
  `)
  return clip(body || 'No note matched.')
}

export const notesCreate = async (input: Record<string, any>): Promise<string> => {
  await osa(`
    const app = Application('Notes')
    app.make({
      new: 'note',
      at: app.defaultAccount().defaultFolder(),
      withProperties: { name: ${lit(input.title)}, body: ${lit(String(input.body ?? '').replace(/\n/g, '<br>'))} }
    })
    'ok'
  `)
  return `Created note "${String(input.title)}".`
}

/* ── Mail ────────────────────────────────────────────────────────────────── */

interface RawMail {
  id: string
  subject: string
  sender: string
  date: string
  preview: string
}

export const mailUnread = async (input: Record<string, any>): Promise<string> => {
  const limit = Math.min(Number(input.limit) || 15, 40)
  const messages = await osa<RawMail[]>(`
    const app = Application('Mail')
    const out = []
    for (const account of app.accounts()) {
      let box
      try { box = account.mailboxes.whose({ name: 'INBOX' })()[0] || account.inbox() } catch (e) { continue }
      if (!box) continue
      let items
      try { items = box.messages.whose({ readStatus: false })() } catch (e) { continue }
      for (const message of items.slice(0, ${limit})) {
        out.push({
          id: String(message.id()),
          subject: String(message.subject() || '(no subject)'),
          sender: String(message.sender()),
          date: message.dateReceived().toISOString(),
          preview: String(message.content()).slice(0, 200).replace(/\\s+/g, ' ')
        })
      }
    }
    out.sort((a, b) => b.date.localeCompare(a.date))
    JSON.stringify(out.slice(0, ${limit}))
  `)

  return lines(
    (messages ?? []).map(
      (message) =>
        `[${message.id}] ${message.sender} — ${message.subject} (${new Date(message.date).toLocaleString()})\n    ${message.preview}`
    ),
    'Nothing unread.'
  )
}

export const mailSearch = async (input: Record<string, any>): Promise<string> => {
  const limit = Math.min(Number(input.limit) || 15, 40)
  const messages = await osa<RawMail[]>(`
    const app = Application('Mail')
    const needle = ${lit(input.query ?? '')}.toLowerCase()
    const out = []
    for (const account of app.accounts()) {
      let box
      try { box = account.mailboxes.whose({ name: 'INBOX' })()[0] || account.inbox() } catch (e) { continue }
      if (!box) continue
      let items
      try { items = box.messages() } catch (e) { continue }
      for (const message of items.slice(0, 300)) {
        const subject = String(message.subject() || '')
        const sender = String(message.sender() || '')
        if (subject.toLowerCase().indexOf(needle) !== -1 || sender.toLowerCase().indexOf(needle) !== -1) {
          out.push({
            id: String(message.id()),
            subject: subject || '(no subject)',
            sender: sender,
            date: message.dateReceived().toISOString(),
            preview: String(message.content()).slice(0, 200).replace(/\\s+/g, ' ')
          })
        }
        if (out.length >= ${limit}) break
      }
    }
    JSON.stringify(out)
  `)

  return lines(
    (messages ?? []).map(
      (message) => `[${message.id}] ${message.sender} — ${message.subject}\n    ${message.preview}`
    ),
    'No messages matched.'
  )
}

export const mailDraft = async (input: Record<string, any>): Promise<string> => {
  await osa(`
    const app = Application('Mail')
    const message = app.OutgoingMessage({
      subject: ${lit(input.subject ?? '')},
      content: ${lit(input.body ?? '')},
      visible: true
    })
    app.outgoingMessages.push(message)
    message.toRecipients.push(app.ToRecipient({ address: ${lit(input.to)} }))
    'ok'
  `)
  return `Opened a Mail draft to ${String(input.to)}. It is not sent — review and hit send.`
}
