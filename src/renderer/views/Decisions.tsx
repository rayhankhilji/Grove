import { useState, type ReactNode } from 'react'
import type { Decision } from '@shared/types'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Empty } from '../components/ui'

const Card = ({ decision }: { decision: Decision }): ReactNode => {
  const { apply } = useStore()
  const [rationale, setRationale] = useState('')
  const [choosing, setChoosing] = useState<string | null>(null)

  const decide = async (chosen: string): Promise<void> => {
    apply(await api.resolveDecision(decision.id, chosen, rationale))
    setChoosing(null)
    setRationale('')
  }

  return (
    <div className="card">
      <div className="card-head">
        <div className="grow">
          <h3>{decision.question}</h3>
          {decision.context ? <p className="why">{decision.context}</p> : null}
        </div>
        <span className={`tag ${decision.status === 'decided' ? 'ok' : 'accent'}`}>
          {decision.status}
        </span>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        {decision.options.map((option) => {
          const isChosen = decision.chosen === option.label
          return (
            <div
              key={option.label}
              style={{
                borderLeft: `2px solid var(${isChosen ? '--accent' : '--line'})`,
                paddingLeft: 12
              }}
            >
              <div className="split">
                <strong style={{ fontSize: 13 }}>{option.label}</strong>
                {decision.status === 'open' ? (
                  <button className="btn tiny" onClick={() => setChoosing(option.label)}>
                    Choose
                  </button>
                ) : isChosen ? (
                  <span className="tag ok">chosen</span>
                ) : null}
              </div>
              <p className="muted" style={{ marginTop: 3 }}>
                <span style={{ color: 'var(--ok)' }}>↑</span> {option.upside}
              </p>
              <p className="muted">
                <span style={{ color: 'var(--bad)' }}>↓</span> {option.risk}
              </p>
            </div>
          )
        })}
      </div>

      {decision.recommendation ? (
        <>
          <div className="section-title">Stobs recommends</div>
          <p style={{ fontSize: 13 }}>{decision.recommendation}</p>
        </>
      ) : null}

      {choosing ? (
        <div className="stack" style={{ marginTop: 14 }}>
          <input
            type="text"
            autoFocus
            value={rationale}
            placeholder={`Why "${choosing}"? (optional)`}
            onChange={(event) => setRationale(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void decide(choosing)
              if (event.key === 'Escape') setChoosing(null)
            }}
          />
          <div className="row">
            <button className="btn primary" onClick={() => void decide(choosing)}>
              Commit to {choosing}
            </button>
            <button className="btn ghost" onClick={() => setChoosing(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {decision.status === 'decided' && decision.rationale ? (
        <p className="muted" style={{ marginTop: 12 }}>
          “{decision.rationale}”
        </p>
      ) : null}

      <div className="split" style={{ marginTop: 14 }}>
        <span className="muted">
          {decision.decidedAt
            ? `Decided ${new Date(decision.decidedAt).toLocaleDateString()}`
            : `Raised ${new Date(decision.createdAt).toLocaleDateString()}`}
        </span>
        <button
          className="btn tiny danger"
          onClick={async () => apply(await api.deleteDecision(decision.id))}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export const Decisions = (): ReactNode => {
  const { state } = useStore()
  const open = state.decisions.filter((d) => d.status === 'open')
  const closed = state.decisions.filter((d) => d.status === 'decided')

  return (
    <>
      <div className="topbar">
        <h2>Decisions</h2>
        <span className="sub">{open.length} open</span>
      </div>

      <div className="scroll">
        <div className="body">
          {state.decisions.length === 0 ? (
            <Empty icon="decisions" title="Nothing on the table.">
              When you bring Stobs something consequential it will lay out the real options and make
              a call. Those land here so you can come back to the reasoning.
            </Empty>
          ) : null}

          {open.map((decision) => (
            <Card key={decision.id} decision={decision} />
          ))}

          {closed.length > 0 ? <div className="section-title">Decided</div> : null}
          {closed.map((decision) => (
            <Card key={decision.id} decision={decision} />
          ))}
        </div>
      </div>
    </>
  )
}
