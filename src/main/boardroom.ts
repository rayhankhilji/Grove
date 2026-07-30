import type { AgentEvent, Meeting, MeetingAttachment, MeetingKind, MeetingTurn } from '@shared/types'
import { PERSONAS, PERSONA_DISCLAIMER, personaFor } from '@shared/personas'
import { runTurn, complete, describeLlmError } from './llm'
import { snapshot } from './tools'
import { speak } from './voice/fish'
import { id, now, store } from './store'

/**
 * The boardroom.
 *
 * A live, turn-taking call between the principal and a chosen bench of
 * advisers. Each seat is a separate generation with only that persona's lens in
 * its system prompt, so the voices stay distinct instead of collapsing into one
 * narrator. The user can cut in at any point and the room reacts.
 */

const KINDS: Record<MeetingKind, { label: string; chair: string }> = {
  board: {
    label: 'Board meeting',
    chair:
      'This is a board meeting. Hold the principal to their numbers and commitments. End with clear decisions and owners.'
  },
  pitch: {
    label: 'Pitch review',
    chair:
      'This is a pitch review. Interrogate the deck as investors would: market, wedge, moat, unit economics, team, ask. Say plainly whether you would take the meeting.'
  },
  critique: {
    label: 'Product critique',
    chair:
      'This is a product critique. Judge the actual experience and craft. Be specific about what to cut, not just what to add.'
  },
  strategy: {
    label: 'Strategy session',
    chair:
      'This is a strategy session. Diagnose the real obstacle before proposing action. Disagree openly about the diagnosis.'
  },
  crisis: {
    label: 'Crisis room',
    chair:
      'This is a crisis. Triage first: what stops the bleeding today, what can wait, what is unrecoverable. Be decisive under incomplete information.'
  },
  hiring: {
    label: 'Hiring debrief',
    chair:
      'This is a hiring debrief. Evaluate against the bar, name the risk you are underwriting, and give a hire / no-hire with reasoning.'
  },
  roast: {
    label: 'Roast',
    chair:
      'This is a roast. Be blunt and funny about the weaknesses, but every joke must contain a real critique the principal can act on.'
  }
}

export const MEETING_KINDS = Object.entries(KINDS).map(([id, value]) => ({
  id: id as MeetingKind,
  label: value.label
}))

/* ── Prompting ───────────────────────────────────────────────────────────── */

const transcriptFor = (meeting: Meeting, limit = 18): string => {
  const recent = meeting.turns.slice(-limit)
  if (recent.length === 0) return '(the room is quiet — you are opening)'
  return recent.map((turn) => `${turn.name}: ${turn.text}`).join('\n\n')
}

const materials = (attachments: MeetingAttachment[]): string => {
  if (attachments.length === 0) return ''
  return `\n\n## Materials on the table\n\n${attachments
    .map((file) => `### ${file.name}\n${file.text.slice(0, 6000)}`)
    .join('\n\n')}`
}

const systemForSeat = (meeting: Meeting, personaId: string): string => {
  const persona = personaFor(personaId)!
  const others = meeting.personaIds
    .filter((entry) => entry !== personaId)
    .map((entry) => personaFor(entry)?.name)
    .filter(Boolean)

  return `You are playing ${persona.name} in a live meeting — an interpretation of their publicly documented thinking, built from their books, talks and interviews. You are not the real person and must never claim to be, never invent biographical facts, and never put words in their mouth as quotations.

How you evaluate:
${persona.lens}

The question you always eventually ask:
${persona.pushback}

${KINDS[meeting.kind].chair}

Also in the room: ${others.join(', ') || 'just the principal'}. The principal is the person whose work is being discussed.

How to speak on this call:
- One contribution at a time, 2–5 sentences. This is talk, not an essay. No headers, no bullet lists.
- React to what was just said. Name people directly when you agree or disagree with them — real rooms argue.
- Stay in your lane. You are here for your specific lens, not to be well-rounded.
- Be concrete about this business, not generic advice. Use the numbers and facts you were given.
- Do not narrate stage directions, do not write your own name as a prefix, and do not summarise the meeting.
- If you have nothing to add beyond what has been said, say something short that moves it forward or hands off.`
}

const contextForSeat = (meeting: Meeting, workspace: string): string =>
  `## The brief

${meeting.brief}${materials(meeting.attachments)}

## What the principal is actually working on

${workspace}

## The call so far

${transcriptFor(meeting)}

Speak now, in character, once.`

/* ── Turn selection ──────────────────────────────────────────────────────── */

/**
 * Picks who talks next. If the principal named someone, they answer. Otherwise
 * the seat that has been quiet longest speaks, which keeps a long call from
 * turning into two people talking.
 */
const nextSpeaker = (meeting: Meeting): string => {
  const last = meeting.turns[meeting.turns.length - 1]

  if (last?.speaker === 'you') {
    const named = meeting.personaIds.find((personaId) => {
      const persona = personaFor(personaId)
      if (!persona) return false
      const surname = persona.name.split(' ').slice(-1)[0]!.toLowerCase()
      return last.text.toLowerCase().includes(surname)
    })
    if (named) return named
  }

  const lastSpoke = new Map<string, number>()
  meeting.personaIds.forEach((personaId) => lastSpoke.set(personaId, -1))
  meeting.turns.forEach((turn, index) => {
    if (lastSpoke.has(turn.speaker)) lastSpoke.set(turn.speaker, index)
  })

  return [...lastSpoke.entries()].sort((a, b) => a[1] - b[1])[0]![0]
}

/* ── Engine ──────────────────────────────────────────────────────────────── */

const meetingById = (meetingId: string): Meeting | undefined =>
  store.get().meetings.find((entry) => entry.id === meetingId)

export interface StartConfig {
  title: string
  kind: MeetingKind
  brief: string
  personaIds: string[]
  attachments: MeetingAttachment[]
}

export const startMeeting = (config: StartConfig): Meeting => {
  const settings = store.get().settings
  const meeting: Meeting = {
    id: id(),
    title: config.title || KINDS[config.kind].label,
    kind: config.kind,
    brief: config.brief,
    attachments: config.attachments,
    personaIds: config.personaIds.slice(0, 8),
    turns: [],
    status: 'live',
    model: settings.boardroomModel,
    voiceEnabled: settings.voiceEnabled,
    summary: '',
    startedAt: now(),
    endedAt: null
  }

  store.update((state) => {
    state.meetings.unshift(meeting)
    if (state.meetings.length > 40) state.meetings.length = 40
  })
  return meeting
}

/** Records something the principal said, so the room can react to it. */
export const interject = (meetingId: string, text: string): MeetingTurn | null => {
  const meeting = meetingById(meetingId)
  if (!meeting || meeting.status === 'ended') return null

  const turn: MeetingTurn = {
    id: id(),
    speaker: 'you',
    name: 'You',
    text,
    audio: null,
    at: now()
  }
  store.update(() => {
    meeting.turns.push(turn)
  })
  return turn
}

/**
 * Generates the next contribution, streaming it as it lands and then rendering
 * it to speech if a voice is mapped to that seat.
 */
export const nextTurn = async (
  meetingId: string,
  emit: (event: AgentEvent) => void
): Promise<MeetingTurn | null> => {
  const meeting = meetingById(meetingId)
  if (!meeting || meeting.status === 'ended') return null

  const personaId = nextSpeaker(meeting)
  const persona = personaFor(personaId)
  if (!persona) return null

  const turn: MeetingTurn = {
    id: id(),
    speaker: personaId,
    name: persona.name,
    text: '',
    audio: null,
    at: now()
  }

  emit({ type: 'meeting.speaking', meetingId, speaker: personaId })
  emit({ type: 'meeting.turn', meetingId, turn })

  try {
    const result = await runTurn({
      model: meeting.model,
      system: systemForSeat(meeting, personaId),
      messages: [{ role: 'user', content: contextForSeat(meeting, snapshot(store.get())) }],
      tools: [],
      maxTokens: 400,
      effort: 'low',
      onText: (chunk) => {
        turn.text += chunk
        emit({ type: 'meeting.delta', meetingId, turnId: turn.id, text: chunk })
      }
    })

    if (!turn.text.trim()) {
      turn.text = result.content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim()
    }
  } catch (error) {
    turn.text = `[${persona.name} could not speak — ${describeLlmError(error)}]`
  }

  store.update(() => {
    meeting.turns.push(turn)
  })
  emit({ type: 'meeting.speaking', meetingId, speaker: null })

  // Voice is best effort: a TTS failure must never break the call.
  const voiceId = store.get().settings.personaVoices[personaId]
  if (meeting.voiceEnabled && voiceId && turn.text) {
    try {
      const audio = await speak(turn.text, voiceId)
      store.update(() => {
        turn.audio = audio
      })
      emit({ type: 'meeting.audio', meetingId, turnId: turn.id, audio })
    } catch {
      /* silence is an acceptable degradation */
    }
  }

  return turn
}

/** Wraps the call: writes a summary and files any decisions into the workspace. */
export const endMeeting = async (
  meetingId: string,
  emit: (event: AgentEvent) => void
): Promise<void> => {
  const meeting = meetingById(meetingId)
  if (!meeting) return

  let summary = ''
  try {
    summary = await complete(
      meeting.model,
      'You write the minutes of an advisory meeting. Be terse and concrete. Never invent anything that was not said.',
      `Write the minutes of this ${KINDS[meeting.kind].label.toLowerCase()}.

Three sections with \`## \` headers, nothing else:

## The verdict
Two or three sentences. What the room actually concluded, including where it split.

## What to do
Three to five specific actions, as a list, each phrased as an instruction.

## Where they disagreed
The genuine disagreement worth revisiting, in one or two lines. If the room agreed, say "The room agreed." and stop.

Brief: ${meeting.brief}

Transcript:
${meeting.turns.map((turn) => `${turn.name}: ${turn.text}`).join('\n\n')}`,
      1200
    )
  } catch (error) {
    summary = `Could not write minutes — ${describeLlmError(error)}`
  }

  const state = store.update((draft) => {
    const target = draft.meetings.find((entry) => entry.id === meetingId)
    if (!target) return
    target.status = 'ended'
    target.endedAt = now()
    target.summary = summary
  })

  emit({ type: 'meeting.ended', meetingId, state })
}

export const deleteMeeting = (meetingId: string): void => {
  store.update((state) => {
    state.meetings = state.meetings.filter((entry) => entry.id !== meetingId)
  })
}

/** Suggested benches, so a first call is one click rather than a casting job. */
export const BENCHES: { id: string; label: string; kind: MeetingKind; personaIds: string[] }[] = [
  {
    id: 'classic-board',
    label: 'The classic board',
    kind: 'board',
    personaIds: ['bezos', 'grove', 'horowitz', 'gurley', 'doerr']
  },
  {
    id: 'product-taste',
    label: 'Product taste',
    kind: 'critique',
    personaIds: ['jobs', 'chesky', 'rams', 'systrom', 'norman']
  },
  {
    id: 'raise',
    label: 'Raising a round',
    kind: 'pitch',
    personaIds: ['thiel', 'gurley', 'wilson', 'lee', 'graham']
  },
  {
    id: 'engineers',
    label: 'The engineers',
    kind: 'critique',
    personaIds: ['carmack', 'wozniak', 'dhh', 'hamilton', 'karpathy']
  },
  {
    id: 'contrarians',
    label: 'Contrarians',
    kind: 'strategy',
    personaIds: ['taleb', 'munger', 'thiel', 'rumelt', 'dhh']
  },
  {
    id: 'growth',
    label: 'Growth room',
    kind: 'strategy',
    personaIds: ['ellis', 'chen', 'weinberg', 'zhang', 'godin']
  }
]

export const ALL_PERSONAS = PERSONAS
export const DISCLAIMER = PERSONA_DISCLAIMER
