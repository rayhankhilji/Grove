import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Icon } from '../components/Icon'
import { Empty, Switch } from '../components/ui'

const humanise = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  return hours === 0 ? `${minutes}m` : `${hours}h ${String(minutes).padStart(2, '0')}m`
}

const RANGES = [
  { label: 'Today', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 }
]

/** Rank is carried by opacity rather than hue — the system has no colour. */
const shadeFor = (index: number): string => `color-mix(in srgb, var(--fg) ${Math.max(22, 100 - index * 11)}%, transparent)`

export const Attention = ({ embedded }: { embedded?: boolean } = {}): ReactNode => {
  const { state, apply } = useStore()
  const [days, setDays] = useState(1)
  const [focus, setFocus] = useState<string>('')

  useEffect(() => {
    const read = (): void => {
      void api.currentFocus().then(setFocus)
    }
    read()
    const timer = setInterval(read, 15_000)
    return () => clearInterval(timer)
  }, [])

  const ranked = useMemo(() => {
    const cutoff = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10)
    const totals = new Map<string, number>()
    for (const day of state.attention.filter((entry) => entry.date >= cutoff)) {
      for (const app of day.apps) totals.set(app.name, (totals.get(app.name) ?? 0) + app.seconds)
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [state.attention, days])

  const total = ranked.reduce((sum, [, seconds]) => sum + seconds, 0)
  const top = ranked[0]

  return (
    <>
      <div className={embedded ? 'viewbar' : 'topbar'}>
        {embedded ? null : <h2>Attention</h2>}
        <div className="row" style={{ marginLeft: 8 }}>
          {RANGES.map((range) => (
            <button
              key={range.days}
              className="chip"
              data-on={days === range.days}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <div className="row">
          <span className="muted">Recording</span>
          <Switch
            on={state.settings.attentionEnabled}
            onChange={async (value) => apply(await api.updateSettings({ attentionEnabled: value }))}
            label="Record attention"
          />
        </div>
      </div>

      <div className="scroll">
        <div className="body">
          {!state.settings.attentionEnabled ? (
            <div className="notice info">
              Recording is off. Grove cannot tell you where your time went while it is not watching
              which app is frontmost.
            </div>
          ) : null}

          <div className="card">
            <div className="split">
              <div>
                <div className="muted">Right now</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>
                  {focus || 'Reading…'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="muted">Active time</div>
                <div style={{ fontSize: 20, fontWeight: 640, fontVariantNumeric: 'tabular-nums' }}>
                  {humanise(total)}
                </div>
              </div>
            </div>
          </div>

          {ranked.length === 0 ? (
            <Empty icon="today" title="Nothing recorded yet.">
              Grove samples which application is frontmost every 20 seconds while you are active. Give
              it a little while, then come back — your agents can use this to check whether your hours
              match your priorities.
            </Empty>
          ) : (
            <>
              <div className="section-title">Where it went</div>
              <div className="card stack tight">
                {ranked.slice(0, 14).map(([name, seconds], index) => {
                  const share = Math.round((seconds / total) * 100)
                  return (
                    <div key={name}>
                      <div className="split" style={{ marginBottom: 4 }}>
                        <span style={{ fontSize: 13 }}>{name}</span>
                        <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {humanise(seconds)} · {share}%
                        </span>
                      </div>
                      <div className="meter" style={{ height: 4 }}>
                        <i style={{ width: `${share}%`, background: shadeFor(index) }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {top && state.objectives.some((objective) => objective.status === 'active') ? (
                <div className="card">
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <Icon name="alert" size={16} />
                    <div className="grow">
                      <strong style={{ fontSize: 13 }}>Hours against objectives</strong>
                      <p className="muted" style={{ marginTop: 4 }}>
                        Your largest block was <strong>{top[0]}</strong> at {humanise(top[1])}. You
                        have{' '}
                        {state.objectives.filter((objective) => objective.status === 'active').length}{' '}
                        active objective(s). Ask the Analyst whether those line up — it can read this
                        ledger directly.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}


        </div>
      </div>
    </>
  )
}
