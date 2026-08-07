import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { FlowEdge, FlowNode, Workflow } from '@shared/types'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Canvas } from '../components/Canvas'
import { BrandMark } from '../components/Brand'
import { Icon } from '../components/Icon'
import { Avatar, Field } from '../components/ui'

/**
 * The automations editor.
 *
 * A flow is a graph: a trigger, then agent and tool nodes wired together. The
 * canvas is the document — the inspector on the right edits whatever is
 * selected, and the builder drafts a whole graph from a sentence.
 *
 * Nothing is saved until you save. Editing happens on a local draft so a
 * half-wired flow never fires on a schedule.
 */

const GRID = 20
const snap = (value: number): number => Math.round(value / GRID) * GRID
const newId = (): string => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export const FlowEditor = ({
  workflow,
  onClose
}: {
  workflow: Workflow
  onClose: () => void
}): ReactNode => {
  const { state, apply } = useStore()
  const [draft, setDraft] = useState<Workflow>(() => ({
    ...workflow,
    nodes: workflow.nodes?.length
      ? workflow.nodes
      : [
          {
            id: newId(),
            kind: 'trigger',
            x: 80,
            y: 180,
            ref: '',
            title: workflow.trigger === 'schedule' ? 'On schedule' : 'When I run it',
            body: ''
          }
        ],
    edges: workflow.edges ?? []
  }))
  const [selected, setSelected] = useState<string | null>(null)
  const [tools, setTools] = useState<{ id: string; label: string; provider: string }[]>([])
  const [prompt, setPrompt] = useState('')
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<'inspector' | 'build'>('inspector')

  useEffect(() => {
    void api.flowTools().then(setTools)
  }, [])

  const node = draft.nodes.find((entry) => entry.id === selected) ?? null

  const patch = (next: Partial<Workflow>): void => setDraft((current) => ({ ...current, ...next }))

  const patchNode = (nodeId: string, next: Partial<FlowNode>): void =>
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.map((entry) => (entry.id === nodeId ? { ...entry, ...next } : entry))
    }))

  const addNode = (kind: FlowNode['kind']): void => {
    // New nodes land to the right of the rightmost one, so adding several in a
    // row lays out a chain instead of a stack.
    const right = draft.nodes.reduce((max, entry) => Math.max(max, entry.x), 0)
    const created: FlowNode = {
      id: newId(),
      kind,
      x: snap(right + 300),
      y: snap(180),
      ref: kind === 'agent' ? (state.agents[0]?.id ?? '') : '',
      title: kind === 'agent' ? (state.agents[0]?.name ?? 'Agent') : kind === 'tool' ? 'Action' : 'Note',
      body: ''
    }
    setDraft((current) => ({ ...current, nodes: [...current.nodes, created] }))
    setSelected(created.id)
    setPanel('inspector')
  }

  const removeNode = (nodeId: string): void =>
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.filter((entry) => entry.id !== nodeId),
      // An edge to a node that no longer exists would render as an arrow into
      // empty space, so they go with it.
      edges: current.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId)
    }))

  const connect = (from: string, to: string): void =>
    setDraft((current) => {
      const exists = current.edges.some((edge) => edge.from === from && edge.to === to)
      const reverse = current.edges.some((edge) => edge.from === to && edge.to === from)
      // Refuse duplicates and the immediate two-node loop; anything longer is
      // caught by the runner, which never visits a node twice.
      if (exists || reverse) return current
      return { ...current, edges: [...current.edges, { id: newId(), from, to } as FlowEdge] }
    })

  const build = async (): Promise<void> => {
    if (!prompt.trim()) return
    setBuilding(true)
    setError(null)
    try {
      const drafted = await api.draftFlow(prompt.trim())
      setDraft((current) => ({
        ...current,
        name: current.name || drafted.name,
        nodes: drafted.nodes,
        edges: drafted.edges
      }))
      setSelected(null)
    } catch (cause) {
      setError((cause as Error).message.replace(/^Error invoking remote method '[^']+': /, ''))
    } finally {
      setBuilding(false)
    }
  }

  const save = async (): Promise<void> => {
    apply(await api.saveWorkflow(draft))
    onClose()
  }

  const toolsByProvider = useMemo(() => {
    const grouped = new Map<string, { id: string; label: string }[]>()
    for (const tool of tools) {
      grouped.set(tool.provider, [...(grouped.get(tool.provider) ?? []), tool])
    }
    return grouped
  }, [tools])

  const agentFor = (ref: string): (typeof state.agents)[number] | undefined =>
    state.agents.find((entry) => entry.id === ref)

  return (
    <>
      <div className="topbar">
        <input
          className="title-input"
          value={draft.name}
          placeholder="Untitled automation"
          onChange={(event) => patch({ name: event.target.value })}
        />
        <div className="spacer" />
        <div className="seg">
          <button data-on={draft.trigger === 'manual'} onClick={() => patch({ trigger: 'manual' })}>
            Manual
          </button>
          <button
            data-on={draft.trigger === 'schedule'}
            onClick={() => patch({ trigger: 'schedule' })}
          >
            Schedule
          </button>
        </div>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" onClick={() => void save()}>
          Save
        </button>
      </div>

      <div className="flow">
        <div className="flow-canvas">
          <div className="flow-tools">
            <button className="tool-add" onClick={() => addNode('agent')}>
              <Icon name="agents" size={15} />
              Agent
            </button>
            <button className="tool-add" onClick={() => addNode('tool')}>
              <Icon name="tool" size={15} />
              Action
            </button>
            <button className="tool-add" onClick={() => addNode('note')}>
              <Icon name="doc" size={15} />
              Note
            </button>
          </div>

          <Canvas
            nodes={draft.nodes}
            edges={draft.edges}
            selected={selected}
            onSelect={setSelected}
            onMove={(nodeId, x, y) => patchNode(nodeId, { x, y })}
            onConnect={connect}
            onDropEdge={(edgeId) =>
              setDraft((current) => ({
                ...current,
                edges: current.edges.filter((edge) => edge.id !== edgeId)
              }))
            }
            renderNode={(entry) => {
              const agent = agentFor(entry.ref)
              return (
                <>
                  <div className="node-head">
                    <span className="node-icon">
                      {entry.kind === 'trigger' ? (
                        <Icon name={draft.trigger === 'schedule' ? 'attention' : 'play'} size={15} />
                      ) : entry.kind === 'agent' ? (
                        <Avatar glyph={agent?.glyph ?? 'agents'} tint={agent?.tint ?? '#2563eb'} size={22} />
                      ) : entry.kind === 'tool' ? (
                        <BrandMark id={entry.ref.split('.')[0] ?? ''} name={entry.ref} size={18} />
                      ) : (
                        <Icon name="doc" size={15} />
                      )}
                    </span>
                    <span className="node-title">{entry.title || entry.kind}</span>
                  </div>
                  {entry.body ? <div className="node-body">{entry.body}</div> : null}
                </>
              )
            }}
          />
        </div>

        <aside className="flow-panel">
          <div className="seg wide">
            <button data-on={panel === 'inspector'} onClick={() => setPanel('inspector')}>
              Inspector
            </button>
            <button data-on={panel === 'build'} onClick={() => setPanel('build')}>
              Build for me
            </button>
          </div>

          {panel === 'build' ? (
            <div className="stack">
              <textarea
                rows={7}
                value={prompt}
                placeholder="Every weekday at 8, read my unread mail, draft replies to anything blocking today, and post a summary to #standup."
                onChange={(event) => setPrompt(event.target.value)}
              />
              <button
                className="btn primary"
                disabled={building || !prompt.trim()}
                onClick={() => void build()}
              >
                <Icon name="sparkle" size={14} />
                {building ? 'Building…' : 'Build the flow'}
              </button>
              {error ? <div className="notice">{error}</div> : null}
              {draft.nodes.length > 1 ? (
                <p className="fineprint">
                  Building replaces the canvas. Your agents and connected apps are the only pieces
                  it can use.
                </p>
              ) : null}
            </div>
          ) : !node ? (
            <div className="stack">
              {draft.trigger === 'schedule' ? (
                <>
                  <Field label="Runs at">
                    <div className="row">
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={draft.schedule.hour}
                        onChange={(event) =>
                          patch({
                            schedule: { ...draft.schedule, hour: Number(event.target.value) }
                          })
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={draft.schedule.minute}
                        onChange={(event) =>
                          patch({
                            schedule: { ...draft.schedule, minute: Number(event.target.value) }
                          })
                        }
                      />
                    </div>
                  </Field>
                  <Field label="On">
                    <div className="days">
                      {DAYS.map((label, index) => (
                        <button
                          key={index}
                          className="day"
                          data-on={draft.schedule.days.includes(index)}
                          onClick={() =>
                            patch({
                              schedule: {
                                ...draft.schedule,
                                days: draft.schedule.days.includes(index)
                                  ? draft.schedule.days.filter((day) => day !== index)
                                  : [...draft.schedule.days, index]
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
              <p className="quiet">Select a node to edit it.</p>
            </div>
          ) : (
            <div className="stack">
              <Field label="Label">
                <input
                  type="text"
                  value={node.title}
                  onChange={(event) => patchNode(node.id, { title: event.target.value })}
                />
              </Field>

              {node.kind === 'agent' ? (
                <>
                  <Field label="Agent">
                    <select
                      value={node.ref}
                      onChange={(event) => {
                        const agent = agentFor(event.target.value)
                        patchNode(node.id, {
                          ref: event.target.value,
                          title: node.title || agent?.name || 'Agent'
                        })
                      }}
                    >
                      {state.agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Instruction">
                    <textarea
                      rows={8}
                      value={node.body}
                      onChange={(event) => patchNode(node.id, { body: event.target.value })}
                    />
                  </Field>
                </>
              ) : null}

              {node.kind === 'tool' ? (
                <>
                  <Field label="Action">
                    <select
                      value={node.ref}
                      onChange={(event) => {
                        const picked = tools.find((tool) => tool.id === event.target.value)
                        patchNode(node.id, {
                          ref: event.target.value,
                          title: picked?.label ?? 'Action'
                        })
                      }}
                    >
                      <option value="">Choose an action…</option>
                      {[...toolsByProvider.entries()].map(([provider, group]) => (
                        <optgroup key={provider} label={provider}>
                          {group.map((tool) => (
                            <option key={tool.id} value={tool.id}>
                              {tool.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </Field>
                  <Field label="Arguments">
                    <textarea
                      rows={7}
                      spellCheck={false}
                      className="mono"
                      value={node.body}
                      placeholder={'{\n  "channel": "C012AB3CD",\n  "text": "{{input}}"\n}'}
                      onChange={(event) => patchNode(node.id, { body: event.target.value })}
                    />
                  </Field>
                  <p className="fineprint">
                    <code>{'{{input}}'}</code> is replaced with whatever the upstream nodes produced.
                  </p>
                </>
              ) : null}

              {node.kind === 'note' ? (
                <Field label="Note">
                  <textarea
                    rows={8}
                    value={node.body}
                    onChange={(event) => patchNode(node.id, { body: event.target.value })}
                  />
                </Field>
              ) : null}

              {node.kind !== 'trigger' ? (
                <button
                  className="btn danger"
                  onClick={() => {
                    removeNode(node.id)
                    setSelected(null)
                  }}
                >
                  <Icon name="trash" size={13} />
                  Remove node
                </button>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
