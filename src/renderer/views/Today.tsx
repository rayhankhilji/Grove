import { useState, type ReactNode } from 'react'
import type { Horizon } from '@shared/types'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Empty, Prose } from '../components/ui'
import { Icon } from '../components/Icon'

const todayKey = (): string => {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const HORIZON_LABEL: Record<Horizon, string> = { now: 'Today', next: 'This week', later: 'Later' }

export const Today = (): ReactNode => {
  const { state, apply, keyStatus } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTask, setNewTask] = useState('')

  const briefing = state.briefings.find((b) => b.date === todayKey())
  const open = state.tasks.filter((task) => !task.done)

  const generate = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await api.generateBriefing()
      await api.getState().then(apply)
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

  const date = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  return (
    <>
      <div className="topbar">
        <h2>Today</h2>
        <span className="sub">{date}</span>
        <div className="spacer" />
        <button
          className="btn"
          onClick={() => void generate()}
          disabled={busy || !keyStatus.configured}
        >
          {busy ? 'Writing…' : briefing ? 'Regenerate' : 'Write briefing'}
        </button>
      </div>

      <div className="scroll">
        <div className="body">
          {error ? <div className="notice">{error}</div> : null}

          {briefing ? (
            <div className="card">
              <Prose markdown={briefing.body} />
            </div>
          ) : (
            <Empty icon="today" title="No briefing yet.">
              {keyStatus.configured
                ? 'Grove will read your objectives, tasks and decisions, then tell you what today is actually for.'
                : 'Add your Anthropic API key in Settings, then Grove can write your first briefing.'}
            </Empty>
          )}

          <div className="section-title">Open tasks</div>

          <div className="row">
            <input
              className="grow"
              type="text"
              value={newTask}
              placeholder="Add a task…"
              onChange={(event) => setNewTask(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void addTask()
              }}
            />
            <button className="btn" onClick={() => void addTask()} disabled={!newTask.trim()}>
              Add
            </button>
          </div>

          {open.length === 0 ? (
            <p className="muted">Nothing open. Either you are done, or nothing is written down.</p>
          ) : (
            (['now', 'next', 'later'] as Horizon[]).map((horizon) => {
              const bucket = open.filter((task) => task.horizon === horizon)
              if (bucket.length === 0) return null
              return (
                <div key={horizon}>
                  <div className="section-title">{HORIZON_LABEL[horizon]}</div>
                  {bucket.map((task) => (
                    <div className="task" key={task.id} data-done={task.done}>
                      <button
                        className="box"
                        data-done={task.done}
                        onClick={async () => apply(await api.toggleTask(task.id))}
                        aria-label={task.done ? 'Reopen task' : 'Complete task'}
                      >
                        <Icon name="check" size={11} strokeWidth={2.4} />
                      </button>
                      <span className="title">{task.title}</span>
                      <button
                        className="icon-btn"
                        onClick={async () => apply(await api.deleteTask(task.id))}
                        aria-label="Delete task"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
