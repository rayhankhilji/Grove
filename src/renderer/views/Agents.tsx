import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Agent, Run } from '@shared/types'
import { MODELS } from '@shared/models'
import { CONNECTORS, connectorToolId, grantCovers, providerGrant } from '@shared/connectors'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { BrandMark } from '../components/Brand'
import { Icon, type IconName } from '../components/Icon'
import { Avatar, Empty, Field, LiveInput, Sheet, relative } from '../components/ui'

const GLYPHS: IconName[] = ['today', 'chat', 'mail', 'calendar', 'objectives', 'doc', 'bolt', 'memory', 'search', 'agents']
const TINTS = ['#2f5d43', '#7a6a4f', '#8a5a3c', '#4a5f7a', '#6b5b7b', '#a4432f', '#3f6f4f', '#8d7a3f']

const WORKSPACE_TOOLS: { id: string; label: string }[] = [
  { id: 'review', label: 'Review the workspace' },
  { id: 'set_objective', label: 'Set objectives' },
  { id: 'update_objective', label: 'Update objectives' },
  { id: 'add_key_result', label: 'Add key results' },
  { id: 'record_progress', label: 'Record progress' },
  { id: 'add_task', label: 'Capture tasks' },
  { id: 'complete_task', label: 'Complete tasks' },
  { id: 'frame_decision', label: 'Frame decisions' },
  { id: 'resolve_decision', label: 'Resolve decisions' },
  { id: 'remember', label: 'Commit to memory' },
  { id: 'update_profile', label: 'Update the profile' }
]

/**
 * How many connector actions a set of grants really reaches. A wildcard reads
 * as one entry but may cover a dozen actions, so counting the raw array would
 * understate what an agent can do.
 */
const reachOf = (toolIds: string[]): number => {
  const actions = CONNECTORS.flatMap((connector) =>
    connector.actions.map((action) => connectorToolId(connector.id, action.id))
  )
  const connectorReach = actions.filter((toolId) =>
    toolIds.some((grant) => grantCovers(grant, toolId))
  ).length
  const direct = toolIds.filter((grant) => !grant.includes('*')).length
  return connectorReach + direct - toolIds.filter((grant) => actions.includes(grant)).length
}

const STATUS_TONE: Record<Run['status'], string> = {
  queued: '',
  running: 'accent',
  awaiting_approval: 'warn',
  succeeded: 'ok',
  failed: 'bad',
  cancelled: ''
}

/* ── Agent editor ────────────────────────────────────────────────────────── */

const Editor = ({ agent, onClose }: { agent: Agent; onClose: () => void }): ReactNode => {
  const { state, apply } = useStore()
  const [draft, setDraft] = useState<Agent>(agent)
  const [expanded, setExpanded] = useState<string | null>(null)

  const patch = (next: Partial<Agent>): void => setDraft((current) => ({ ...current, ...next }))

  const toggleTool = (toolId: string): void =>
    patch({
      toolIds: draft.toolIds.includes(toolId)
        ? draft.toolIds.filter((entry) => entry !== toolId)
        : [...draft.toolIds, toolId]
    })

  const save = async (): Promise<void> => {
    apply(await api.saveAgent(draft))
    onClose()
  }

  const connected = new Set(
    state.connections.filter((entry) => entry.status === 'connected').map((entry) => entry.providerId)
  )

  const reach = reachOf(draft.toolIds)

  /*
   * A full pane, like the boardroom composer. An agent is a name, a brief, and
   * a set of permissions over twenty apps — a modal cannot show the permissions
   * and what you are writing at the same time, which is what made this a wall.
   */
  return (
    <>
      <div className="topbar">
        <h2>{agent.builtIn ? agent.name : draft.name || 'New agent'}</h2>
        <div className="spacer" />
        {!agent.builtIn && state.agents.some((entry) => entry.id === agent.id) ? (
          <button
            className="btn danger"
            onClick={async () => {
              apply(await api.deleteAgent(agent.id))
              onClose()
            }}
          >
            Delete
          </button>
        ) : null}
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" disabled={!draft.name.trim()} onClick={() => void save()}>
          Save
        </button>
      </div>

      <div className="scroll">
        <div className="compose">
          <div className="compose-col">
            <section className="block">
              <div className="block-head">
                <h3>Identity</h3>
              </div>
              <div className="card stack">
                <div className="identity">
                  <Avatar glyph={draft.glyph} tint={draft.tint} size={46} />
                  <div className="grow stack tight">
                    <input
                      type="text"
                      value={draft.name}
                      placeholder="Agent name"
                      onChange={(event) => patch({ name: event.target.value })}
                    />
                    <input
                      type="text"
                      value={draft.role}
                      placeholder="What it is for, in one line"
                      onChange={(event) => patch({ role: event.target.value })}
                    />
                  </div>
                </div>

                <div className="glyph-row">
                  {GLYPHS.map((glyph) => (
                    <button
                      key={glyph}
                      className="glyph-pick"
                      data-on={draft.glyph === glyph}
                      onClick={() => patch({ glyph })}
                      aria-label={`Icon ${glyph}`}
                    >
                      <Icon name={glyph} size={17} />
                    </button>
                  ))}
                </div>

                <div className="tint-row">
                  {TINTS.map((tint) => (
                    <button
                      key={tint}
                      className="tint-pick"
                      data-on={draft.tint === tint}
                      style={{ background: tint }}
                      onClick={() => patch({ tint })}
                      aria-label={`Colour ${tint}`}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="block">
              <div className="block-head">
                <h3>Instructions</h3>
              </div>
              <div className="card">
                <LiveInput
                  multiline
                  rows={10}
                  value={draft.instructions}
                  onCommit={(value) => patch({ instructions: value })}
                />
              </div>
            </section>

            <section className="block">
              <div className="block-head">
                <h3>How it runs</h3>
              </div>
              <div className="card stack">
                <div className="pair">
                  <Field label="Model">
                    <select
                      value={draft.model}
                      onChange={(event) => patch({ model: event.target.value })}
                    >
                      {MODELS.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Reasoning">
                    <select
                      value={draft.effort}
                      onChange={(event) => patch({ effort: event.target.value as Agent['effort'] })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </Field>
                </div>

                <div className="field">
                  <label>Acting on your behalf</label>
                  <div className="seg wide">
                    <button
                      data-on={draft.autonomy === 'supervised'}
                      onClick={() => patch({ autonomy: 'supervised' })}
                    >
                      Ask first
                    </button>
                    <button
                      data-on={draft.autonomy === 'autonomous'}
                      onClick={() => patch({ autonomy: 'autonomous' })}
                    >
                      Full access
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="block">
              <div className="block-head">
                <h3>Hands off to</h3>
              </div>
              <div className="wrap-list">
                {state.agents
                  .filter((candidate) => candidate.id !== draft.id)
                  .map((candidate) => (
                    <button
                      key={candidate.id}
                      className="tool-pick"
                      data-on={draft.handoffIds.includes(candidate.id)}
                      onClick={() =>
                        patch({
                          handoffIds: draft.handoffIds.includes(candidate.id)
                            ? draft.handoffIds.filter((entry) => entry !== candidate.id)
                            : [...draft.handoffIds, candidate.id]
                        })
                      }
                    >
                      <Icon name={draft.handoffIds.includes(candidate.id) ? 'check' : 'plus'} size={12} />
                      {candidate.name}
                    </button>
                  ))}
              </div>
            </section>
          </div>

          <div className="compose-col">
            <section className="block">
              <div className="block-head">
                <h3>Permissions</h3>
                <span className="counter">{reach} tools</span>
              </div>

              <div className="card">
                <div className="wrap-list">
                  {WORKSPACE_TOOLS.map((tool) => (
                    <button
                      key={tool.id}
                      className="tool-pick"
                      data-on={draft.toolIds.includes(tool.id)}
                      onClick={() => toggleTool(tool.id)}
                    >
                      <Icon name={draft.toolIds.includes(tool.id) ? 'check' : 'plus'} size={12} />
                      {tool.label}
                    </button>
                  ))}
                </div>
              </div>

              {/*
                One row per app, expanding to its individual actions. Twenty
                connectors laid out flat is the wall this used to be — collapsed,
                the whole permission surface fits on one screen.
              */}
              <div className="grants">
                {CONNECTORS.map((connector) => {
                  const whole = providerGrant(connector.id)
                  const grantedWhole = draft.toolIds.includes(whole)
                  const picked = connector.actions.filter((action) =>
                    draft.toolIds.includes(connectorToolId(connector.id, action.id))
                  ).length
                  const count = grantedWhole ? connector.actions.length : picked
                  const isOpen = expanded === connector.id

                  return (
                    <div className="grant" key={connector.id} data-on={count > 0}>
                      <div className="grant-head">
                        <BrandMark id={connector.id} name={connector.name} size={20} />
                        <button
                          className="grant-name"
                          onClick={() => setExpanded(isOpen ? null : connector.id)}
                        >
                          {connector.name}
                          {!connected.has(connector.id) ? <span className="off">not connected</span> : null}
                        </button>
                        {count > 0 ? <span className="tag">{count}</span> : null}
                        <button
                          className={`grant-all${grantedWhole ? ' on' : ''}`}
                          onClick={() => toggleTool(whole)}
                        >
                          {grantedWhole ? 'All on' : 'All'}
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={isOpen ? 'Collapse' : 'Expand'}
                          onClick={() => setExpanded(isOpen ? null : connector.id)}
                        >
                          <Icon name="chevron" size={14} />
                        </button>
                      </div>

                      {isOpen ? (
                        <div className="grant-actions">
                          {connector.actions.map((action) => {
                            const toolId = connectorToolId(connector.id, action.id)
                            const explicit = draft.toolIds.includes(toolId)
                            return (
                              <button
                                key={toolId}
                                className="tool-pick"
                                data-on={explicit || grantedWhole}
                                data-inherited={grantedWhole && !explicit}
                                disabled={grantedWhole}
                                onClick={() => toggleTool(toolId)}
                              >
                                <Icon name={explicit || grantedWhole ? 'check' : 'plus'} size={12} />
                                {action.label}
                                {action.write ? <span className="tag warn">write</span> : null}
                              </button>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}

/* ── Launch ──────────────────────────────────────────────────────────────── */

const Launch = ({ agent, onClose }: { agent: Agent; onClose: () => void }): ReactNode => {
  const { apply } = useStore()
  const [task, setTask] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async (): Promise<void> => {
    if (!task.trim()) return
    setBusy(true)
    onClose()
    apply(await api.launchAgent(agent.id, task.trim()))
  }

  return (
    <Sheet
      title={`Launch ${agent.name}`}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={() => void go()} disabled={busy || !task.trim()}>
            <Icon name="play" size={13} />
            Launch
          </button>
        </>
      }
    >
      <Field label="Task">
        <textarea
          rows={5}
          autoFocus
          value={task}
          placeholder="e.g. Review everything that landed in my inbox today and tell me what needs a reply."
          onChange={(event) => setTask(event.target.value)}
        />
      </Field>
    </Sheet>
  )
}

/* ── Run detail ──────────────────────────────────────────────────────────── */

const RunDetail = ({ run, onClose }: { run: Run; onClose: () => void }): ReactNode => {
  const { apply } = useStore()

  return (
    <Sheet
      title={run.agentName}
      onClose={onClose}
      actions={
        run.status === 'running' || run.status === 'awaiting_approval' ? (
          <button
            className="btn danger"
            onClick={async () => {
              apply(await api.cancelRun(run.id))
              onClose()
            }}
          >
            Stop run
          </button>
        ) : null
      }
    >
      <div className="row">
        <span className={`tag ${STATUS_TONE[run.status]}`}>{run.status.replace('_', ' ')}</span>
        <span className="muted">
          {run.trigger} · {run.triggeredBy} · {relative(run.startedAt)}
        </span>
      </div>

      <div className="card">
        <div className="muted" style={{ marginBottom: 4 }}>
          Task
        </div>
        <div style={{ fontSize: 13, userSelect: 'text' }}>{run.input}</div>
      </div>

      {run.pending ? (
        <div className="card" style={{ borderColor: 'var(--accent-line)' }}>
          <strong style={{ fontSize: 13 }}>Waiting on you</strong>
          <p className="muted" style={{ whiteSpace: 'pre-wrap', margin: '4px 0 10px' }}>
            {run.pending.summary}
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              className="btn"
              onClick={() => void api.settleApproval(run.pending!.stepId, false)}
            >
              Decline
            </button>
            <button
              className="btn primary"
              onClick={() => void api.settleApproval(run.pending!.stepId, true)}
            >
              Approve
            </button>
          </div>
        </div>
      ) : null}

      <div className="section-title">Timeline</div>
      <div className="timeline">
        {run.steps.length === 0 ? <p className="muted">No steps yet.</p> : null}
        {run.steps.map((step) => (
          <div className="tl-step" key={step.id}>
            <div className={`tl-mark ${step.kind === 'error' ? 'bad' : 'accent'}`}>
              <Icon
                name={
                  step.kind === 'handoff'
                    ? 'handoff'
                    : step.kind === 'error'
                      ? 'alert'
                      : step.kind === 'text'
                        ? 'check'
                        : 'tool'
                }
                size={12}
              />
            </div>
            <div className="tl-body">
              <div className="tl-title">{step.label}</div>
              {step.detail ? <div className="tl-detail">{step.detail}</div> : null}
            </div>
          </div>
        ))}
      </div>

      {run.output ? (
        <>
          <div className="section-title">Result</div>
          <div className="card" style={{ userSelect: 'text', fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {run.output}
          </div>
        </>
      ) : null}

      {run.error ? <div className="notice">{run.error}</div> : null}

      {run.tokensIn > 0 ? (
        <span className="muted">
          {run.tokensIn.toLocaleString()} in · {run.tokensOut.toLocaleString()} out
        </span>
      ) : null}
    </Sheet>
  )
}

/* ── View ────────────────────────────────────────────────────────────────── */

export const Agents = (): ReactNode => {
  const { state, apply } = useStore()
  const [tab, setTab] = useState<'team' | 'activity'>('team')
  const [editing, setEditing] = useState<Agent | null>(null)
  const [launching, setLaunching] = useState<Agent | null>(null)
  const [openRun, setOpenRun] = useState<string | null>(null)

  const active = state.runs.filter(
    (run) => run.status === 'running' || run.status === 'awaiting_approval'
  ).length

  // Keep the open run sheet in sync as its steps stream in.
  const detail = useMemo(
    () => state.runs.find((run) => run.id === openRun) ?? null,
    [state.runs, openRun]
  )

  useEffect(() => {
    if (active > 0) setTab((current) => (current === 'team' ? current : 'activity'))
  }, [active])

  const blank = (): Agent => ({
    id: '',
    name: '',
    role: '',
    glyph: 'agents',
    tint: TINTS[0]!,
    model: state.settings.model,
    effort: 'high',
    instructions: '',
    toolIds: ['review'],
    handoffIds: [],
    autonomy: 'supervised',
    builtIn: false,
    createdAt: '',
    updatedAt: ''
  })

  // The editor owns the pane while it is open — it is a page, not an overlay.
  if (editing) return <Editor agent={editing} onClose={() => setEditing(null)} />

  return (
    <>
      <div className="topbar">
        <h2>Agents</h2>
        <div className="tabs">
          <button className="tab" data-on={tab === 'team'} onClick={() => setTab('team')}>
            Team
          </button>
          <button className="tab" data-on={tab === 'activity'} onClick={() => setTab('activity')}>
            Activity{active > 0 ? ` · ${active}` : ''}
          </button>
        </div>
        <div className="spacer" />
        {tab === 'team' ? (
          <button className="btn" onClick={() => setEditing(blank())}>
            <Icon name="plus" size={14} />
            New agent
          </button>
        ) : (
          <button className="btn ghost" onClick={async () => apply(await api.clearRuns())}>
            Clear finished
          </button>
        )}
      </div>

      <div className="scroll">
        <div className="body wide">
          {tab === 'team' ? (
            <div className="grid-2">
              {state.agents.map((agent) => (
                <div className="agent-card" key={agent.id} onClick={() => setEditing(agent)}>
                  <div className="row">
                    <Avatar glyph={agent.glyph} tint={agent.tint} />
                    <div className="grow">
                      <div className="agent-name">{agent.name}</div>
                    </div>
                  </div>

                  <div className="row" style={{ flexWrap: 'wrap', gap: 5 }}>
                    <span className="tag">{MODELS.find((m) => m.id === agent.model)?.label ?? agent.model}</span>
                    <span className="tag">{reachOf(agent.toolIds)} tools</span>
                    {agent.handoffIds.length > 0 ? (
                      <span className="tag">
                        <Icon name="handoff" size={11} />
                        {agent.handoffIds.length}
                      </span>
                    ) : null}
                    <span className={`tag ${agent.autonomy === 'autonomous' ? 'warn' : ''}`}>
                      {agent.autonomy === 'autonomous' ? 'autonomous' : 'supervised'}
                    </span>
                  </div>

                  <div className="row">
                    <button
                      className="btn tiny primary"
                      onClick={(event) => {
                        event.stopPropagation()
                        setLaunching(agent)
                      }}
                    >
                      <Icon name="play" size={12} />
                      Launch
                    </button>
                    <button
                      className="btn tiny"
                      onClick={(event) => {
                        event.stopPropagation()
                        setEditing(agent)
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : state.runs.length === 0 ? (
            <Empty icon="bolt" title="No runs yet" />
          ) : (
            <div className="card flush">
              {state.runs.map((run) => (
                <div className="run-row" key={run.id} onClick={() => setOpenRun(run.id)}>
                  <span
                    className={`dot ${
                      run.status === 'running'
                        ? 'run'
                        : run.status === 'succeeded'
                          ? 'ok'
                          : run.status === 'failed'
                            ? 'bad'
                            : ''
                    }`}
                  />
                  <div className="grow">
                    <div style={{ fontSize: 13 }}>
                      <strong>{run.agentName}</strong>
                      <span className="muted"> · {run.input.slice(0, 70)}</span>
                    </div>
                    <div className="muted">
                      {run.trigger} · {run.triggeredBy} · {run.steps.length} steps
                      {run.parentRunId ? ' · handed off' : ''}
                    </div>
                  </div>
                  {run.status === 'awaiting_approval' ? (
                    <span className="tag warn">needs you</span>
                  ) : null}
                  <span className="when">{relative(run.startedAt)}</span>
                  <Icon name="chevron" size={14} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {launching ? <Launch agent={launching} onClose={() => setLaunching(null)} /> : null}
      {detail ? <RunDetail run={detail} onClose={() => setOpenRun(null)} /> : null}
    </>
  )
}
