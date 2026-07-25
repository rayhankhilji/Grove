import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Agent, Run } from '@shared/types'
import { MODELS } from '@shared/models'
import { CONNECTORS, connectorToolId } from '@shared/connectors'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Icon, type IconName } from '../components/Icon'
import { Avatar, Empty, Field, LiveInput, Sheet, relative } from '../components/ui'

const GLYPHS: IconName[] = ['today', 'council', 'mail', 'calendar', 'objectives', 'doc', 'bolt', 'memory', 'search', 'agents']
const TINTS = ['#4ec5b6', '#6ea8e8', '#b48ce0', '#5cc08a', '#d8b45f', '#e0736b', '#7f8ff5', '#54c0d8']

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

  return (
    <Sheet
      title={agent.builtIn ? `Edit ${agent.name}` : draft.name || 'New agent'}
      onClose={onClose}
      actions={
        <>
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
          <button className="btn primary" onClick={() => void save()}>
            Save agent
          </button>
        </>
      }
    >
      <div className="row">
        <Avatar glyph={draft.glyph} tint={draft.tint} size={44} />
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
            placeholder="What this agent is for, in one line"
            onChange={(event) => patch({ role: event.target.value })}
          />
        </div>
      </div>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        {GLYPHS.map((glyph) => (
          <button
            key={glyph}
            className="icon-btn"
            style={{ color: draft.glyph === glyph ? draft.tint : undefined }}
            onClick={() => patch({ glyph })}
            aria-label={`Icon ${glyph}`}
          >
            <Icon name={glyph} size={17} />
          </button>
        ))}
        <div style={{ width: 8 }} />
        {TINTS.map((tint) => (
          <button
            key={tint}
            onClick={() => patch({ tint })}
            aria-label={`Colour ${tint}`}
            style={{
              width: 17,
              height: 17,
              borderRadius: 99,
              background: tint,
              border: draft.tint === tint ? '2px solid var(--ink)' : '1px solid var(--line)',
              cursor: 'pointer'
            }}
          />
        ))}
      </div>

      <Field label="Instructions" hint="How this agent thinks, what it prioritises, what it never does.">
        <LiveInput multiline rows={7} value={draft.instructions} onCommit={(value) => patch({ instructions: value })} />
      </Field>

      <div className="row">
        <Field label="Model">
          <select value={draft.model} onChange={(event) => patch({ model: event.target.value })}>
            {MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Effort">
          <select
            value={draft.effort}
            onChange={(event) => patch({ effort: event.target.value as Agent['effort'] })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Field>
        <Field label="Autonomy">
          <select
            value={draft.autonomy}
            onChange={(event) => patch({ autonomy: event.target.value as Agent['autonomy'] })}
          >
            <option value="supervised">Ask before external actions</option>
            <option value="autonomous">Act without asking</option>
          </select>
        </Field>
      </div>

      <div className="field">
        <label>Workspace tools</label>
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

      {CONNECTORS.map((connector) => (
        <div className="field" key={connector.id}>
          <label>
            {connector.name}
            {!connected.has(connector.id) ? (
              <span className="muted"> · not connected, tools stay inactive</span>
            ) : null}
          </label>
          <div className="wrap-list">
            {connector.actions.map((action) => {
              const toolId = connectorToolId(connector.id, action.id)
              return (
                <button
                  key={toolId}
                  className="tool-pick"
                  data-on={draft.toolIds.includes(toolId)}
                  onClick={() => toggleTool(toolId)}
                >
                  <Icon name={draft.toolIds.includes(toolId) ? 'check' : 'plus'} size={12} />
                  {action.label}
                  {action.write ? <span className="tag warn">write</span> : null}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="field">
        <label>Can hand off to</label>
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
                <Icon name="handoff" size={12} />
                {candidate.name}
              </button>
            ))}
        </div>
      </div>
    </Sheet>
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
      <p className="muted">
        {agent.role}. It runs on its own and reports back in Activity — you do not have to wait here.
      </p>
      <Field label="Task" hint="Be specific. The agent cannot see your chat history.">
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

  return (
    <>
      <div className="topbar">
        <h2>Agents</h2>
        <div className="row" style={{ marginLeft: 8 }}>
          <button
            className={`chip${tab === 'team' ? '' : ''}`}
            data-on={tab === 'team'}
            onClick={() => setTab('team')}
          >
            Team · {state.agents.length}
          </button>
          <button className="chip" data-on={tab === 'activity'} onClick={() => setTab('activity')}>
            Activity{active > 0 ? ` · ${active} live` : ''}
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
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{agent.name}</div>
                      <div className="muted">{agent.role}</div>
                    </div>
                  </div>

                  <div className="row" style={{ flexWrap: 'wrap', gap: 5 }}>
                    <span className="tag">{MODELS.find((m) => m.id === agent.model)?.label ?? agent.model}</span>
                    <span className="tag">{agent.toolIds.length} tools</span>
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
            <Empty icon="bolt" title="No runs yet.">
              Launch an agent, or let an automation fire one. Every run lands here with its full
              timeline — the tools it called and what came back.
            </Empty>
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

      {editing ? <Editor agent={editing} onClose={() => setEditing(null)} /> : null}
      {launching ? <Launch agent={launching} onClose={() => setLaunching(null)} /> : null}
      {detail ? <RunDetail run={detail} onClose={() => setOpenRun(null)} /> : null}
    </>
  )
}
