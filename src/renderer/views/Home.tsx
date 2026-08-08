import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Horizon } from '@shared/types'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Prose, Ring, relative } from '../components/ui'
import { Icon } from '../components/Icon'
import { Objectives } from './Objectives'
import { Decisions } from './Decisions'
import { Attention } from './Attention'

/**
 * Objectives, decisions and where your hours went are all answers to "how am
 * I actually doing" — four rail entries for one question. They live here as
 * tabs instead, which is also what stops the sidebar being a list you read.
 */
const TABS = [
  { id: 'overview' as const, label: 'Overview' },
  { id: 'objectives' as const, label: 'Objectives' },
  { id: 'decisions' as const, label: 'Decisions' },
  { id: 'attention' as const, label: 'Attention' }
]

type Tab = (typeof TABS)[number]['id']

/**
 * Home.
 *
 * The first screen has one job: answer "what do I do now" without making
 * anyone read. It does that in a fixed order of urgency —
 *
 *   1. Setup, but only while Grove cannot actually work yet.
 *   2. Anything waiting on a decision from you.
 *   3. Today: the briefing and what is open.
 *   4. What is moving, and what just happened.
 *
 * Each block disappears entirely when it has nothing to say, so the screen
 * shortens as things get handled rather than filling with empty frames.
 */

const todayKey = (): string => {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const HORIZON: Record<Horizon, string> = { now: 'Today', next: 'This week', later: 'Later' }

export interface HomeProps {
  onGo: (view: string) => void
  onStartChat: () => void
}

export const Home = ({ onGo, onStartChat }: HomeProps): ReactNode => {
  const { state, apply } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTask, setNewTask] = useState('')
  const [providers, setProviders] = useState<string[]>([])
  const [tab, setTab] = useState<Tab>('overview')

  useEffect(() => {
    void api.configuredProviders().then(setProviders)
  }, [])

  const briefing = state.briefings.find((entry) => entry.date === todayKey())
  const open = state.tasks.filter((task) => !task.done)
  const connected = state.connections.filter((entry) => entry.status === 'connected')
  const live = state.runs.filter(
    (run) => run.status === 'running' || run.status === 'awaiting_approval'
  )
  const waiting = state.runs.filter((run) => run.status === 'awaiting_approval')
  const objectives = state.objectives.filter((objective) => objective.status === 'active')
  const openDecisions = state.decisions.filter((decision) => decision.status === 'open')

  const hasModel = providers.length > 0 || Object.values(state.settings.providerAuth).includes('subscription')

  /** Setup is three steps, and it stops existing once they are done. */
  const steps = useMemo(
    () => [
      { id: 'providers', label: 'Connect a model', done: hasModel, go: 'providers' },
      { id: 'profile', label: 'Say who you are', done: Boolean(state.profile.name), go: 'settings' },
      { id: 'apps', label: 'Connect your apps', done: connected.length > 0, go: 'connections' }
    ],
    [hasModel, state.profile.name, connected.length]
  )
  const remaining = steps.filter((step) => !step.done)

  const generate = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await api.generateBriefing()
      apply(await api.getState())
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const addTask = async (): Promise<void> => {
    const title = newTask.trim()
    if (!title) return
    setNewTask('')
    apply(await api.createTask(title, 'now', null))
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const date = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })

  return (
    <>
      <div className="topbar">
        <div className="tabs">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              className="tab"
              data-on={tab === entry.id}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        {tab === 'overview' ? (
          <>
            <button className="btn" onClick={() => void generate()} disabled={busy || !hasModel}>
              {busy ? 'Writing…' : briefing ? 'New briefing' : 'Write briefing'}
            </button>
            <button className="btn primary" onClick={onStartChat}>
              <Icon name="chat" size={14} />
              Ask Grove
            </button>
          </>
        ) : null}
      </div>

      {tab === 'objectives' ? <Objectives embedded /> : null}
      {tab === 'decisions' ? <Decisions embedded /> : null}
      {tab === 'attention' ? <Attention embedded /> : null}

      {tab !== 'overview' ? null : (
      <div className="scroll">
        <div className="body">
          <header className="hero">
            <h1>
              {greeting},{' '}
              {state.profile.name ? (
                state.profile.name.split(' ')[0]
              ) : (
                <button className="name-gap" onClick={() => onGo('settings')}>
                  who are you?
                </button>
              )}
            </h1>
            <p>{date}</p>
          </header>

          {error ? <div className="notice">{error}</div> : null}

          {/* ── Setup, while it still matters ─────────────────────────── */}
          {remaining.length > 0 ? (
            <section className="block">
              <div className="block-head">
                <h3>Set up Grove</h3>
                <span className="counter">
                  {steps.length - remaining.length}/{steps.length}
                </span>
              </div>
              <div className="steps-grid">
                {steps.map((step, index) => (
                  <button
                    className="setup-step"
                    key={step.id}
                    data-done={step.done}
                    onClick={() => onGo(step.go)}
                  >
                    <span className="mark">
                      {step.done ? <Icon name="check" size={13} strokeWidth={2.4} /> : index + 1}
                    </span>
                    <span className="grow">{step.label}</span>
                    {!step.done ? <Icon name="chevron" size={14} /> : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── Anything blocked on you ───────────────────────────────── */}
          {waiting.length > 0 || live.length > 0 ? (
            <section className="block">
              <div className="block-head">
                <h3>{waiting.length > 0 ? 'Waiting on you' : 'Running now'}</h3>
                <button className="btn tiny" onClick={() => onGo('agents')}>
                  Open
                </button>
              </div>
              <div className="list">
                {live.map((run) => (
                  <button className="line" key={run.id} onClick={() => onGo('agents')}>
                    <span className={`dot ${run.status === 'awaiting_approval' ? 'warn' : 'run'}`} />
                    <span className="grow">
                      <strong>{run.agentName}</strong> {run.input.slice(0, 80)}
                    </span>
                    {run.status === 'awaiting_approval' ? (
                      <span className="tag warn">approve</span>
                    ) : null}
                    <span className="when">{relative(run.startedAt)}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── Today ─────────────────────────────────────────────────── */}
          {briefing ? (
            <section className="block">
              <div className="block-head">
                <h3>Your briefing</h3>
                <span className="counter">{relative(briefing.generatedAt)}</span>
              </div>
              <div className="card">
                <Prose markdown={briefing.body} />
              </div>
            </section>
          ) : null}

          {/*
            Four things worth doing from here, so the screen is a place you act
            from rather than a report you read. Each one opens where the work
            actually happens.
          */}
          <section className="block">
            <div className="block-head">
              <h3>Jump in</h3>
            </div>
            <div className="quick-grid">
              <button className="quick" onClick={onStartChat}>
                <span className="quick-mark">
                  <Icon name="chat" size={17} />
                </span>
                <span className="quick-name">Ask Grove</span>
                <span className="quick-meta">{state.agents.length} agents</span>
              </button>
              <button className="quick" onClick={() => onGo('boardroom')}>
                <span className="quick-mark">
                  <Icon name="boardroom" size={17} />
                </span>
                <span className="quick-name">Convene a room</span>
                <span className="quick-meta">{state.meetings.length} held</span>
              </button>
              <button className="quick" onClick={() => onGo('automations')}>
                <span className="quick-mark">
                  <Icon name="automations" size={17} />
                </span>
                <span className="quick-name">Automate something</span>
                <span className="quick-meta">{state.workflows.length} running</span>
              </button>
              <button className="quick" onClick={() => onGo('knowledge')}>
                <span className="quick-mark">
                  <Icon name="brain" size={17} />
                </span>
                <span className="quick-name">Teach it something</span>
                <span className="quick-meta">{state.brain.length} entries</span>
              </button>
            </div>
          </section>

          {/* ── Tasks ─────────────────────────────────────────────────── */}
          <section className="block">
            <div className="block-head">
              <h3>Tasks</h3>
              {open.length > 0 ? <span className="counter">{open.length} open</span> : null}
            </div>

            <div className="task-list">
              <div className="task-new">
                <span className="box ghost">
                  <Icon name="plus" size={12} strokeWidth={2.4} />
                </span>
                <input
                  type="text"
                  value={newTask}
                  placeholder="What needs doing?"
                  onChange={(event) => setNewTask(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void addTask()
                  }}
                />
                {newTask.trim() ? (
                  <button className="btn tiny primary" onClick={() => void addTask()}>
                    Add
                  </button>
                ) : null}
              </div>

              {(['now', 'next', 'later'] as Horizon[]).map((horizon) => {
                const bucket = open.filter((task) => task.horizon === horizon)
                if (bucket.length === 0) return null
                return bucket.map((task) => (
                  <div className="task" key={task.id}>
                    <button
                      className="box"
                      onClick={async () => apply(await api.toggleTask(task.id))}
                      aria-label="Complete task"
                    >
                      <Icon name="check" size={11} strokeWidth={2.6} />
                    </button>
                    <span className="grow">{task.title}</span>
                    <span className="horizon">{HORIZON[horizon]}</span>
                    <button
                      className="icon-btn"
                      onClick={async () => apply(await api.deleteTask(task.id))}
                      aria-label="Delete task"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))
              })}
            </div>
          </section>

          {/* ── What is moving ────────────────────────────────────────── */}
          {objectives.length > 0 ? (
            <section className="block">
              <div className="block-head">
                <h3>Moving</h3>
                <button className="btn tiny" onClick={() => setTab('objectives')}>
                  Open
                </button>
              </div>
              <div className="list">
                {objectives.slice(0, 4).map((objective) => {
                  const done = objective.keyResults.length
                    ? Math.round(
                        objective.keyResults.reduce((sum, kr) => {
                          const span = kr.target - kr.start
                          const pct = span === 0 ? (kr.current >= kr.target ? 100 : 0) : ((kr.current - kr.start) / span) * 100
                          return sum + Math.max(0, Math.min(100, pct))
                        }, 0) / objective.keyResults.length
                      )
                    : 0
                  return (
                    <button className="line" key={objective.id} onClick={() => setTab('objectives')}>
                      <Ring value={done} size={30} />
                      <span className="grow">{objective.title}</span>
                      <span className="when">{HORIZON[objective.horizon]}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}

          {/* ── Open decisions ────────────────────────────────────────── */}
          {openDecisions.length > 0 ? (
            <section className="block">
              <div className="block-head">
                <h3>To decide</h3>
                <button className="btn tiny" onClick={() => setTab('decisions')}>
                  Open
                </button>
              </div>
              <div className="list">
                {openDecisions.slice(0, 4).map((decision) => (
                  <button className="line" key={decision.id} onClick={() => setTab('decisions')}>
                    <Icon name="decisions" size={16} />
                    <span className="grow">{decision.question}</span>
                    <span className="when">{decision.options.length} options</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
      )}
    </>
  )
}
