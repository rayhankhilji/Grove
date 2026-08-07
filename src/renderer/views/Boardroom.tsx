import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Meeting, MeetingAttachment, MeetingTurn } from '@shared/types'
import { DOMAINS, PERSONAS, PERSONA_DISCLAIMER, personaFor } from '@shared/personas'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Icon } from '../components/Icon'
import { Empty, Field, Prose, Sheet, relative } from '../components/ui'
import { Shader } from '../components/Shader'

/** Initials tile — the personas have no portraits, and shouldn't. */
const Seat = ({
  personaId,
  speaking,
  size = 84
}: {
  personaId: string
  speaking: boolean
  size?: number
}): ReactNode => {
  const persona = personaFor(personaId)
  if (!persona) return null
  const initials = persona.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)

  return (
    <div className="seat" data-speaking={speaking} style={{ width: size }}>
      <div className="seat-tile" style={{ width: size * 0.62, height: size * 0.62 }}>
        <span className="initials" style={{ fontSize: size * 0.2 }}>
          {initials}
        </span>
        {speaking ? (
          <span className="seat-live">
            <i />
            <i />
            <i />
          </span>
        ) : null}
      </div>
      <div className="seat-name">{persona.name}</div>
      <div className="seat-role">{persona.domain}</div>
    </div>
  )
}

/* ── Setup ───────────────────────────────────────────────────────────────── */

const Setup = ({ onClose }: { onClose: () => void }): ReactNode => {
  const { state, apply } = useStore()
  const [kind, setKind] = useState('board')
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [attachments, setAttachments] = useState<MeetingAttachment[]>([])
  const [domain, setDomain] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [meta, setMeta] = useState<{ kinds: { id: string; label: string }[]; benches: { id: string; label: string; kind: string; personaIds: string[] }[] }>({ kinds: [], benches: [] })

  useEffect(() => {
    void api.boardMeta().then(setMeta)
  }, [])

  const visible = useMemo(
    () =>
      PERSONAS.filter(
        (persona) =>
          (domain === 'All' || persona.domain === domain) &&
          (!search ||
            persona.name.toLowerCase().includes(search.toLowerCase()) ||
            persona.known.toLowerCase().includes(search.toLowerCase()))
      ),
    [domain, search]
  )

  const toggle = (personaId: string): void =>
    setPicked((current) =>
      current.includes(personaId)
        ? current.filter((entry) => entry !== personaId)
        : current.length >= 8
          ? current
          : [...current, personaId]
    )

  const begin = async (): Promise<void> => {
    if (picked.length === 0 || !brief.trim()) return
    await api.startMeeting({ title, kind, brief, personaIds: picked, attachments })
    apply(await api.getState())
    onClose()
  }

  return (
    <Sheet
      title="Convene a room"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={picked.length === 0 || !brief.trim()}
            onClick={() => void begin()}
          >
            <Icon name="play" size={13} />
            Start the call
          </button>
        </>
      }
    >
      <Field label="Kind of meeting">
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          {meta.kinds.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Title">
        <input
          type="text"
          value={title}
          placeholder="Series A readiness"
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      <Field label="The brief">
        <textarea
          rows={4}
          value={brief}
          placeholder="We're at $18k MRR, growing 9% monthly, 14 months runway. I want to know whether to raise now or push to $40k first."
          onChange={(event) => setBrief(event.target.value)}
        />
      </Field>

      <Field label="Materials">
        <div className="row">
          <button
            className="btn"
            onClick={async () => {
              const added = await api.attachMaterials()
              setAttachments((current) => [...current, ...added])
            }}
          >
            <Icon name="doc" size={14} />
            Add files
          </button>
          {attachments.map((file) => (
            <span className="tag accent" key={file.name}>
              {file.name} · {Math.round(file.text.length / 1000)}k
            </span>
          ))}
        </div>
      </Field>

      <div className="section-title">Suggested benches</div>
      <div className="wrap-list">
        {meta.benches.map((bench) => (
          <button
            key={bench.id}
            className="tool-pick"
            onClick={() => {
              setPicked(bench.personaIds)
              setKind(bench.kind)
            }}
          >
            <Icon name="agents" size={12} />
            {bench.label}
          </button>
        ))}
      </div>

      <div className="section-title">The bench · {picked.length}/8</div>
      <div className="row">
        <input
          className="grow"
          type="text"
          value={search}
          placeholder="Search the bench…"
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          value={domain}
          style={{ width: 'auto' }}
          onChange={(event) => setDomain(event.target.value)}
        >
          <option value="All">All</option>
          {DOMAINS.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>
      </div>

      <div className="persona-grid">
        {visible.map((persona) => (
          <button
            key={persona.id}
            className="persona-pick"
            data-on={picked.includes(persona.id)}
            onClick={() => toggle(persona.id)}
          >
            <span className="grow">
              <strong>{persona.name}</strong>
              <span className="meta">{persona.brief || persona.known}</span>
            </span>
            {state.settings.personaVoices[persona.id] ? (
              <Icon name="sparkle" size={12} />
            ) : null}
          </button>
        ))}
      </div>

      <p className="muted">{PERSONA_DISCLAIMER}</p>
    </Sheet>
  )
}

/* ── Live call ───────────────────────────────────────────────────────────── */

const Call = ({ meeting, onLeave }: { meeting: Meeting; onLeave: () => void }): ReactNode => {
  const { state, apply } = useStore()
  const [speaking, setSpeaking] = useState<string | null>(null)
  const [live, setLive] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState('')
  const [auto, setAuto] = useState(true)
  const [busy, setBusy] = useState(false)
  const [stalled, setStalled] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(
    () =>
      api.onAgentEvent((event) => {
        switch (event.type) {
          case 'meeting.speaking':
            if (event.meetingId === meeting.id) setSpeaking(event.speaker)
            break
          case 'meeting.delta':
            if (event.meetingId === meeting.id) {
              setLive((current) => ({
                ...current,
                [event.turnId]: (current[event.turnId] ?? '') + event.text
              }))
            }
            break
          case 'meeting.turn':
            if (event.meetingId === meeting.id) void api.getState().then(apply)
            break
          case 'meeting.audio':
            if (event.meetingId === meeting.id) {
              // Play the rendered line; overlapping speech would be unlistenable.
              audio.current?.pause()
              audio.current = new Audio(event.audio)
              void audio.current.play().catch(() => undefined)
            }
            break
          case 'meeting.ended':
            if (event.meetingId === meeting.id) apply(event.state)
            break
        }
      }),
    [meeting.id, apply]
  )

  /**
   * Drive the conversation forward while auto-run is on.
   *
   * The first failure stops the room. A model that cannot answer for one seat
   * will not answer for the next either, and letting the loop continue is what
   * filled a transcript with forty identical apologies.
   */
  useEffect(() => {
    if (!auto || busy || stalled || meeting.status === 'ended') return
    const timer = setTimeout(async () => {
      setBusy(true)
      try {
        apply(await api.nextTurn(meeting.id))
        setLive({})
      } catch (error) {
        setAuto(false)
        setStalled((error as Error).message.replace(/^Error invoking remote method '[^']+': /, ''))
      } finally {
        setBusy(false)
      }
    }, 700)
    return () => clearTimeout(timer)
  }, [auto, busy, stalled, meeting.turns.length, meeting.status, meeting.id, apply])

  useLayoutEffect(() => {
    const node = scroller.current
    if (node) node.scrollTop = node.scrollHeight
  }, [meeting.turns.length, live])

  const say = async (): Promise<void> => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    apply(await api.sayInMeeting(meeting.id, text))
  }

  const leave = async (): Promise<void> => {
    setAuto(false)
    audio.current?.pause()
    setBusy(true)
    apply(await api.endMeeting(meeting.id))
    setBusy(false)
  }

  const liveTurnId = Object.keys(live)[0]

  return (
    <>
      <div className="topbar">
        <h2>{meeting.title}</h2>
        <span className="sub">
          {meeting.turns.length} turns · {meeting.personaIds.length} in the room
        </span>
        <div className="spacer" />
        {meeting.status === 'live' ? (
          <div className="row">
            <button className="chip" data-on={auto} onClick={() => setAuto((value) => !value)}>
              <Icon name={auto ? 'pause' : 'play'} size={12} />
              {auto ? 'Running' : 'Paused'}
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                setStalled(null)
                try {
                  apply(await api.nextTurn(meeting.id))
                } catch (error) {
                  setStalled((error as Error).message.replace(/^Error invoking remote method '[^']+': /, ''))
                } finally {
                  setBusy(false)
                }
              }}
            >
              Next turn
            </button>
            <button className="btn danger" onClick={() => void leave()} disabled={busy}>
              End call
            </button>
          </div>
        ) : (
          <button className="btn ghost" onClick={onLeave}>
            Back
          </button>
        )}
      </div>

      <div className="stage">
        <Shader intensity={0.07} />
        {meeting.personaIds.map((personaId) => (
          <Seat key={personaId} personaId={personaId} speaking={speaking === personaId} />
        ))}
      </div>

      <div className="scroll" ref={scroller}>
        <div className="thread" style={{ paddingTop: 14 }}>
          {stalled ? (
            <div className="notice stall">
              <strong>The room stopped.</strong>
              {stalled}
              <button className="btn tiny" onClick={() => setStalled(null)}>
                Try again
              </button>
            </div>
          ) : null}
          {meeting.turns.map((turn: MeetingTurn) => {
            const persona = personaFor(turn.speaker)
            return turn.speaker === 'you' ? (
              <div className="turn-user" key={turn.id}>
                <div className="bubble">{turn.text}</div>
              </div>
            ) : (
              <div className="turn-agent" key={turn.id}>
                <div className="answer-head">
                  <span className="dot" style={{ width: 6, height: 6 }} />
                  <span className="name">{turn.name}</span>
                  <span className="model">{persona?.domain}</span>
                  {turn.audio ? (
                    <button
                      className="icon-btn"
                      aria-label="Replay"
                      onClick={() => {
                        audio.current?.pause()
                        audio.current = new Audio(turn.audio!)
                        void audio.current.play().catch(() => undefined)
                      }}
                    >
                      <Icon name="play" size={13} />
                    </button>
                  ) : null}
                </div>
                <div className="prose" style={{ fontSize: 13.5 }}>
                  {turn.text}
                </div>
              </div>
            )
          })}

          {speaking && liveTurnId ? (
            <div className="turn-agent">
              <div className="answer-head">
                <span className="dot run" style={{ width: 6, height: 6 }} />
                <span className="name">{personaFor(speaking)?.name}</span>
              </div>
              <div className="prose" style={{ fontSize: 13.5 }}>
                {live[liveTurnId]}
                <span className="caret" />
              </div>
            </div>
          ) : null}

          {meeting.status === 'ended' && meeting.summary ? (
            <div className="card">
              <div className="section-title">Minutes</div>
              <Prose markdown={meeting.summary} />
            </div>
          ) : null}
        </div>
      </div>

      {meeting.status === 'live' ? (
        <div className="composer">
          <div className="composer-inner">
            <textarea
              rows={1}
              value={draft}
              placeholder="Cut in — name someone to put them on the spot…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void say()
                }
              }}
            />
            <div className="composer-bar">
              <span className="muted" style={{ fontSize: 11 }}>
                {state.settings.voiceEnabled ? 'Voice on' : 'Voice off'} · {PERSONA_DISCLAIMER}
              </span>
              <div className="grow" />
              <button className="send" onClick={() => void say()} disabled={!draft.trim()}>
                <Icon name="send" size={15} strokeWidth={1.9} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

/* ── View ────────────────────────────────────────────────────────────────── */

export const Boardroom = (): ReactNode => {
  const { state, apply } = useStore()
  const [setup, setSetup] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const live = state.meetings.find((meeting) => meeting.status === 'live')
  const open = state.meetings.find((meeting) => meeting.id === openId) ?? live ?? null

  if (open) return <Call meeting={open} onLeave={() => setOpenId(null)} />

  return (
    <>
      <div className="topbar">
        <h2>Boardroom</h2>
        <span className="sub">{PERSONAS.length} advisers on the bench</span>
        <div className="spacer" />
        <button className="btn primary" onClick={() => setSetup(true)}>
          <Icon name="plus" size={14} />
          Convene
        </button>
      </div>

      <div className="scroll">
        <div className="body">
          {state.meetings.length === 0 ? (
            <Empty icon="boardroom" title="No calls yet" />
          ) : (
            state.meetings.map((meeting) => (
              <div className="card" key={meeting.id}>
                <div className="split">
                  <div className="grow">
                    <div className="row">
                      <strong style={{ fontSize: 13.5 }}>{meeting.title}</strong>
                      <span className={`tag ${meeting.status === 'live' ? 'accent' : ''}`}>
                        {meeting.status === 'live' ? 'live' : 'ended'}
                      </span>
                    </div>
                    <div className="muted" style={{ marginTop: 3 }}>
                      {meeting.turns.length} turns · {relative(meeting.startedAt)}
                    </div>
                    <div className="pill-list">
                      {meeting.personaIds.map((personaId) => (
                        <span className="tag" key={personaId}>
                          {personaFor(personaId)?.name ?? personaId}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="row">
                    <button className="btn tiny" onClick={() => setOpenId(meeting.id)}>
                      Open
                    </button>
                    <button
                      className="icon-btn danger"
                      aria-label="Delete"
                      onClick={async () => apply(await api.deleteMeeting(meeting.id))}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {setup ? <Setup onClose={() => setSetup(false)} /> : null}
    </>
  )
}
