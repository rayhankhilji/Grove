import { useState, type ReactNode } from 'react'
import type { KeyResult, Objective, ObjectiveStatus } from '@shared/types'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Empty, Ring } from '../components/ui'

const percent = (kr: KeyResult): number => {
  const span = kr.target - kr.start
  if (span === 0) return kr.current >= kr.target ? 100 : 0
  return Math.max(0, Math.min(100, Math.round(((kr.current - kr.start) / span) * 100)))
}

const progress = (objective: Objective): number => {
  if (objective.keyResults.length === 0) return objective.status === 'achieved' ? 100 : 0
  return Math.round(
    objective.keyResults.reduce((sum, kr) => sum + percent(kr), 0) / objective.keyResults.length
  )
}

const STATUSES: ObjectiveStatus[] = ['active', 'paused', 'achieved', 'dropped']

const KeyResultRow = ({
  objective,
  kr
}: {
  objective: Objective
  kr: KeyResult
}): ReactNode => {
  const { apply } = useStore()
  const [value, setValue] = useState(String(kr.current))

  const commit = async (): Promise<void> => {
    const parsed = Number(value)
    if (Number.isNaN(parsed) || parsed === kr.current) {
      setValue(String(kr.current))
      return
    }
    apply(await api.updateKeyResult(objective.id, kr.id, parsed))
  }

  return (
    <div className="kr">
      <span className="name">{kr.title}</span>
      <span className="nums">
        <input
          type="number"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
          aria-label={`Current value for ${kr.title}`}
        />
        <span>
          / {kr.target} {kr.unit}
        </span>
      </span>
      <div className="meter">
        <i style={{ width: `${percent(kr)}%` }} />
      </div>
    </div>
  )
}

export const Objectives = (): ReactNode => {
  const { state, apply } = useStore()
  const [showClosed, setShowClosed] = useState(false)

  const isOpen = (o: Objective): boolean => o.status === 'active' || o.status === 'paused'
  const visible = state.objectives.filter((o) => (showClosed ? !isOpen(o) : isOpen(o)))
  const closedCount = state.objectives.filter((o) => !isOpen(o)).length

  return (
    <>
      <div className="topbar">
        <h2>Objectives</h2>
        <span className="sub">
          {state.objectives.filter(isOpen).length} open
          {closedCount > 0 ? ` · ${closedCount} closed` : ''}
        </span>
        <div className="spacer" />
        <button className="btn ghost" onClick={() => setShowClosed((v) => !v)}>
          {showClosed ? 'Show open' : 'Show closed'}
        </button>
      </div>

      <div className="scroll">
        <div className="body">
          {visible.length === 0 ? (
            <Empty icon="objectives" title={showClosed ? 'Nothing closed yet.' : 'No objectives.'}>
              Objectives are set in conversation. Tell Grove what you are trying to achieve and it
              will write them down with measurable key results.
            </Empty>
          ) : (
            visible.map((objective) => (
              <div className="card" key={objective.id}>
                <div className="card-head">
                  <Ring value={progress(objective)} />
                  <div className="grow">
                    <h3>{objective.title}</h3>
                    {objective.why ? <p className="why">{objective.why}</p> : null}
                  </div>
                  <span className="tag">{objective.horizon}</span>
                </div>

                {objective.keyResults.map((kr) => (
                  <KeyResultRow key={kr.id} objective={objective} kr={kr} />
                ))}

                {objective.keyResults.length === 0 ? (
                  <p className="muted" style={{ marginTop: 10 }}>
                    No key results — ask Grove to add something measurable.
                  </p>
                ) : null}

                <div className="split" style={{ marginTop: 14 }}>
                  <span className="muted">
                    {objective.dueDate ? `Due ${objective.dueDate}` : 'No target date'}
                  </span>
                  <div className="row">
                    <select
                      value={objective.status}
                      style={{ width: 'auto' }}
                      onChange={async (event) =>
                        apply(
                          await api.updateObjective({
                            id: objective.id,
                            status: event.target.value as ObjectiveStatus
                          })
                        )
                      }
                      aria-label="Objective status"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn tiny danger"
                      onClick={async () => apply(await api.deleteObjective(objective.id))}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
