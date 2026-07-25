import { useState, type ReactNode } from 'react'
import type { Workflow, WorkflowStep } from '@shared/types'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Icon } from '../components/Icon'
import { Empty, Field, Sheet, Switch, relative } from '../components/ui'

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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

const Editor = ({ workflow, onClose }: { workflow: Workflow; onClose: () => void }): ReactNode => {
  const { state, apply } = useStore()
  const [draft, setDraft] = useState<Workflow>(workflow)

  const patch = (next: Partial<Workflow>): void => setDraft((current) => ({ ...current, ...next }))

  const patchStep = (index: number, next: Partial<WorkflowStep>): void =>
    patch({
      steps: draft.steps.map((step, position) =>
        position === index ? { ...step, ...next } : step
      )
    })

  const addStep = (): void =>
    patch({
      steps: [
        ...draft.steps,
        {
          id: `${Date.now()}-${draft.steps.length}`,
          agentId: state.agents[0]?.id ?? '',
          instruction: '',
          usePrevious: draft.steps.length > 0
        }
      ]
    })

  const time = `${String(draft.schedule.hour).padStart(2, '0')}:${String(draft.schedule.minute).padStart(2, '0')}`

  return (
    <Sheet
      title={draft.name || 'New automation'}
      onClose={onClose}
      actions={
        <>
          {state.workflows.some((entry) => entry.id === draft.id) ? (
            <button
              className="btn danger"
              onClick={async () => {
                apply(await api.deleteWorkflow(draft.id))
                onClose()
              }}
            >
              Delete
            </button>
          ) : null}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={async () => {
              apply(await api.saveWorkflow(draft))
              onClose()
            }}
            disabled={draft.steps.length === 0 || !draft.name.trim()}
          >
            Save
          </button>
        </>
      }
    >
      <Field label="Name">
        <input
          type="text"
          value={draft.name}
          placeholder="Morning brief"
          onChange={(event) => patch({ name: event.target.value })}
        />
      </Field>

      <Field label="Trigger">
        <select
          value={draft.trigger}
          onChange={(event) => patch({ trigger: event.target.value as Workflow['trigger'] })}
        >
          <option value="manual">Run manually</option>
          <option value="schedule">On a schedule</option>
        </select>
      </Field>

      {draft.trigger === 'schedule' ? (
        <>
          <Field label="Time">
            <input
              type="time"
              value={time}
              onChange={(event) => {
                const [hour, minute] = event.target.value.split(':')
                patch({
                  schedule: {
                    ...draft.schedule,
                    hour: Number(hour ?? 8),
                    minute: Number(minute ?? 0)
                  }
                })
              }}
            />
          </Field>
          <Field label="Days" hint="Leave all off to run every day.">
            <div className="row">
              {DAYS.map((label, day) => (
                <button
                  key={day}
                  className="tool-pick"
                  data-on={draft.schedule.days.includes(day)}
                  style={{ width: 36, justifyContent: 'center' }}
                  onClick={() =>
                    patch({
                      schedule: {
                        ...draft.schedule,
                        days: draft.schedule.days.includes(day)
                          ? draft.schedule.days.filter((entry) => entry !== day)
                          : [...draft.schedule.days, day].sort()
                      }
                    })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        </>
      ) : null}

      <div className="section-title">Steps</div>
      {draft.steps.map((step, index) => (
        <div className="card stack tight" key={step.id}>
          <div className="split">
            <span className="tag accent">Step {index + 1}</span>
            <button
              className="icon-btn danger"
              onClick={() => patch({ steps: draft.steps.filter((_, position) => position !== index) })}
              aria-label="Remove step"
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
          <select value={step.agentId} onChange={(event) => patchStep(index, { agentId: event.target.value })}>
            {state.agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <textarea
            rows={3}
            value={step.instruction}
            placeholder="What should this agent do?"
            onChange={(event) => patchStep(index, { instruction: event.target.value })}
          />
          {index > 0 ? (
            <div className="split">
              <span className="muted">Pass the previous step's output in as context</span>
              <Switch
                on={step.usePrevious}
                onChange={(value) => patchStep(index, { usePrevious: value })}
                label="Use previous output"
              />
            </div>
          ) : null}
        </div>
      ))}

      <button className="btn" onClick={addStep}>
        <Icon name="plus" size={14} />
        Add step
      </button>
    </Sheet>
  )
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
    enabled: true,
    lastRunAt: null,
    createdAt: ''
  })

  const run = async (workflow: Workflow): Promise<void> => {
    setRunning(workflow.id)
    apply(await api.runWorkflow(workflow.id))
    setRunning(null)
  }

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
          {!state.settings.automationsEnabled && state.workflows.length > 0 ? (
            <div className="notice info">
              Automations are paused. Scheduled runs will not fire until you switch them back on.
            </div>
          ) : null}

          {state.workflows.length === 0 ? (
            <Empty icon="workflows" title="No automations yet.">
              Chain your agents into something that runs without you — a morning brief at 7am, an
              inbox sweep at 5pm, a Friday review that pulls the week's numbers.
            </Empty>
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

      {editing ? <Editor workflow={editing} onClose={() => setEditing(null)} /> : null}
    </>
  )
}
