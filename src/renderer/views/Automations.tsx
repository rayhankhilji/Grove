import { useState, type ReactNode } from 'react'
import type { Workflow } from '@shared/types'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { FlowEditor } from './FlowEditor'
import { Icon } from '../components/Icon'
import { Empty, Switch, relative } from '../components/ui'


const nextRun = (workflow: Workflow): string => {
  if (workflow.trigger !== 'schedule' || !workflow.enabled) return 'Manual only'
  const { hour, minute, days } = workflow.schedule
  const at = new Date()
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date()
    candidate.setDate(at.getDate() + offset)
    candidate.setHours(hour, minute, 0, 0)
    if (candidate <= at) continue
    if (days.length > 0 && !days.includes(candidate.getDay())) continue
    return candidate.toLocaleString(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit'
    })
  }
  return 'Not scheduled'
}

export const Automations = (): ReactNode => {
  const { state, apply } = useStore()
  const [editing, setEditing] = useState<Workflow | null>(null)
  const [running, setRunning] = useState<string | null>(null)

  const blank = (): Workflow => ({
    id: '',
    name: '',
    description: '',
    trigger: 'schedule',
    schedule: { hour: 8, minute: 0, days: [1, 2, 3, 4, 5] },
    steps: [],
    nodes: [],
    edges: [],
    enabled: true,
    lastRunAt: null,
    createdAt: ''
  })

  const run = async (workflow: Workflow): Promise<void> => {
    setRunning(workflow.id)
    apply(await api.runWorkflow(workflow.id))
    setRunning(null)
  }

  // The canvas owns the pane while it is open — a flow is a document.
  if (editing) return <FlowEditor workflow={editing} onClose={() => setEditing(null)} />

  return (
    <>
      <div className="topbar">
        <h2>Automations</h2>
        <span className="sub">
          {state.workflows.filter((entry) => entry.enabled && entry.trigger === 'schedule').length}{' '}
          scheduled
        </span>
        <div className="spacer" />
        <div className="row">
          <span className="muted">All automations</span>
          <Switch
            on={state.settings.automationsEnabled}
            onChange={async (value) => apply(await api.updateSettings({ automationsEnabled: value }))}
            label="Enable automations"
          />
          <button className="btn" onClick={() => setEditing(blank())}>
            <Icon name="plus" size={14} />
            New
          </button>
        </div>
      </div>

      <div className="scroll">
        <div className="body">
          {state.workflows.length === 0 ? (
            <Empty icon="automations" title="No automations yet" />
          ) : (
            state.workflows.map((workflow) => (
              <div className="card" key={workflow.id}>
                <div className="split">
                  <div className="grow">
                    <div className="row">
                      <Icon name={workflow.trigger === 'schedule' ? 'clock' : 'play'} size={15} />
                      <strong style={{ fontSize: 13.5 }}>{workflow.name}</strong>
                      {workflow.trigger === 'schedule' ? (
                        <span className="tag">{nextRun(workflow)}</span>
                      ) : null}
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {workflow.steps.length} step{workflow.steps.length === 1 ? '' : 's'}
                      {workflow.lastRunAt ? ` · last ran ${relative(workflow.lastRunAt)}` : ' · never run'}
                    </div>
                  </div>
                  <Switch
                    on={workflow.enabled}
                    onChange={async (value) =>
                      apply(await api.saveWorkflow({ id: workflow.id, enabled: value }))
                    }
                    label="Enable this automation"
                  />
                </div>

                <div className="pill-list">
                  {workflow.steps.map((step, index) => {
                    const agent = state.agents.find((entry) => entry.id === step.agentId)
                    return (
                      <span className="tag" key={step.id}>
                        {index > 0 ? '→ ' : ''}
                        {agent?.name ?? 'missing agent'}
                      </span>
                    )
                  })}
                </div>

                <div className="row" style={{ marginTop: 12 }}>
                  <button
                    className="btn tiny primary"
                    disabled={running === workflow.id}
                    onClick={() => void run(workflow)}
                  >
                    <Icon name="play" size={12} />
                    {running === workflow.id ? 'Running…' : 'Run now'}
                  </button>
                  <button className="btn tiny" onClick={() => setEditing(workflow)}>
                    Edit
                  </button>
                </div>
              </div>
            ))
          )}

          {state.workflowRuns.length > 0 ? (
            <>
              <div className="section-title">Recent</div>
              <div className="card flush">
                {state.workflowRuns.slice(0, 12).map((workflowRun) => (
                  <div className="run-row" key={workflowRun.id} style={{ cursor: 'default' }}>
                    <span
                      className={`dot ${
                        workflowRun.status === 'running'
                          ? 'run'
                          : workflowRun.status === 'succeeded'
                            ? 'ok'
                            : workflowRun.status === 'failed'
                              ? 'bad'
                              : ''
                      }`}
                    />
                    <div className="grow">
                      <div style={{ fontSize: 13 }}>{workflowRun.workflowName}</div>
                      <div className="muted">
                        {workflowRun.runIds.length} run{workflowRun.runIds.length === 1 ? '' : 's'}
                        {workflowRun.error ? ` · ${workflowRun.error}` : ''}
                      </div>
                    </div>
                    <span className="when">{relative(workflowRun.startedAt)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

    </>
  )
}
