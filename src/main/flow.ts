import type { FlowEdge, FlowNode, Workflow } from '@shared/types'
import { CONNECTORS } from '@shared/connectors'
import { ALL_TOOLS, toolById } from './tools'
import { complete } from './llm'
import { WORKER_MODEL } from '@shared/providers'
import { id, store } from './store'

/**
 * The automations graph.
 *
 * A workflow used to be a list of steps. It is a graph now: a trigger, then
 * agent and tool nodes wired together. Execution still walks it one node at a
 * time — the value of the canvas is being able to see and branch the shape of
 * the work, not running four models at once.
 */

/* ── Migration ───────────────────────────────────────────────────────────── */

const GRID = 20
export const snap = (value: number): number => Math.round(value / GRID) * GRID

/**
 * Turns a legacy linear workflow into a graph, so an old automation opens on
 * the canvas instead of appearing empty. Runs on read, never persisted until
 * the user actually saves.
 */
export const asGraph = (workflow: Workflow): { nodes: FlowNode[]; edges: FlowEdge[] } => {
  if (workflow.nodes?.length) return { nodes: workflow.nodes, edges: workflow.edges ?? [] }

  const nodes: FlowNode[] = [
    {
      id: `${workflow.id}-trigger`,
      kind: 'trigger',
      x: 80,
      y: 200,
      ref: '',
      title: workflow.trigger === 'schedule' ? 'On schedule' : 'When I run it',
      body: ''
    }
  ]
  const edges: FlowEdge[] = []

  workflow.steps.forEach((step, index) => {
    const agent = store.get().agents.find((entry) => entry.id === step.agentId)
    const node: FlowNode = {
      id: step.id,
      kind: 'agent',
      x: 80 + (index + 1) * 300,
      y: 200,
      ref: step.agentId,
      title: agent?.name ?? 'Agent',
      body: step.instruction
    }
    nodes.push(node)
    edges.push({ id: id(), from: nodes[nodes.length - 2]!.id, to: node.id })
  })

  return { nodes, edges }
}

/* ── Ordering ────────────────────────────────────────────────────────────── */

/**
 * The order nodes run in: a breadth-first walk out from the trigger.
 *
 * Cycles are not an error the user should have to think about — a node simply
 * never runs twice, which turns an accidental loop into a flow that stops.
 */
export const walkOrder = (nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to])
  }

  const start = nodes.find((node) => node.kind === 'trigger') ?? nodes[0]
  if (!start) return []

  const seen = new Set<string>()
  const order: FlowNode[] = []
  const queue = [start.id]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (seen.has(current)) continue
    seen.add(current)
    const node = byId.get(current)
    if (!node) continue
    order.push(node)
    for (const next of outgoing.get(current) ?? []) queue.push(next)
  }

  // Notes are annotation, and a trigger has nothing to execute.
  return order.filter((node) => node.kind === 'agent' || node.kind === 'tool')
}

/** What feeds a node: the output of everything wired into it. */
export const inputsFor = (nodeId: string, edges: FlowEdge[]): string[] =>
  edges.filter((edge) => edge.to === nodeId).map((edge) => edge.from)

/* ── Building a flow from a description ──────────────────────────────────── */

const SCHEMA = `Reply with one JSON object and nothing else — no prose, no code fence.

{
  "name": "short name for the automation",
  "nodes": [
    { "id": "n1", "kind": "trigger", "title": "Every weekday at 8am" },
    { "id": "n2", "kind": "agent",  "ref": "<agent id>", "title": "short label", "body": "the instruction for that agent" },
    { "id": "n3", "kind": "tool",   "ref": "<tool id>",  "title": "short label", "body": "{\\"argument\\":\\"value\\"}" }
  ],
  "edges": [ { "from": "n1", "to": "n2" }, { "from": "n2", "to": "n3" } ]
}

Rules:
- Exactly one trigger node, and it must be first with no incoming edge.
- Prefer a tool node over an agent node when the work is mechanical — reading a
  calendar, posting a message. Agents cost a model call; tools do not.
- Use an agent node when the step needs judgement, writing or summarising.
- \`ref\` must be one of the ids listed below, exactly. Never invent one.
- \`body\` on a tool node is a JSON object matching that tool's arguments.
- Between three and eight nodes. Keep it linear unless branching is genuinely
  needed.`

/**
 * Asks a model to draft a flow from a sentence.
 *
 * Everything it returns is checked against the real agent and tool registries
 * before it reaches the canvas — a hallucinated tool id becomes a dropped node,
 * never a workflow that explodes at 7am on a Tuesday.
 */
export const draftFlow = async (
  description: string
): Promise<{ name: string; nodes: FlowNode[]; edges: FlowEdge[] }> => {
  const state = store.get()

  const agents = state.agents
    .map((agent) => `  ${agent.id} — ${agent.name}: ${agent.role}`)
    .join('\n')

  const connected = new Set(
    state.connections.filter((entry) => entry.status === 'connected').map((entry) => entry.providerId)
  )
  // Only offer tools that can actually run right now. Drafting a flow around
  // Slack when Slack is not connected produces something that looks finished
  // and fails on first use.
  const tools = ALL_TOOLS.filter((tool) => !tool.provider || connected.has(tool.provider))
    .map((tool) => `  ${tool.id} — ${tool.label}`)
    .join('\n')

  const raw = await complete(
    state.settings.boardroomModel || WORKER_MODEL,
    `You design automations for a personal-CEO app. ${SCHEMA}

Available agents:
${agents}

Available tools:
${tools || '  (no apps connected yet — use agent nodes only)'}`,
    `Build an automation for this:\n\n${description}`,
    2000
  )

  return parseFlow(raw)
}

/** Extracts and validates a graph from whatever the model returned. */
export const parseFlow = (
  raw: string
): { name: string; nodes: FlowNode[]; edges: FlowEdge[] } => {
  // Models fence JSON about half the time; take the outermost object either way.
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('The model did not return a flow.')

  const parsed = JSON.parse(raw.slice(start, end + 1)) as {
    name?: string
    nodes?: { id?: string; kind?: string; ref?: string; title?: string; body?: string }[]
    edges?: { from?: string; to?: string }[]
  }

  const agentIds = new Set(store.get().agents.map((agent) => agent.id))
  const remap = new Map<string, string>()
  const nodes: FlowNode[] = []

  let column = 0
  for (const draft of parsed.nodes ?? []) {
    const kind = draft.kind as FlowNode['kind']
    if (!['trigger', 'agent', 'tool', 'note'].includes(kind)) continue

    const ref = String(draft.ref ?? '')
    if (kind === 'agent' && !agentIds.has(ref)) continue
    if (kind === 'tool' && !toolById(ref)) continue

    const node: FlowNode = {
      id: id(),
      kind,
      // Laid out left to right on the grid; the user rearranges from there.
      x: snap(80 + column * 300),
      y: snap(200),
      ref,
      title: String(draft.title ?? kind),
      body: String(draft.body ?? '')
    }
    if (draft.id) remap.set(draft.id, node.id)
    nodes.push(node)
    column += 1
  }

  if (nodes.length === 0) throw new Error('The model returned no usable nodes.')
  if (!nodes.some((node) => node.kind === 'trigger')) {
    nodes.unshift({
      id: id(),
      kind: 'trigger',
      x: snap(80),
      y: snap(200),
      ref: '',
      title: 'When I run it',
      body: ''
    })
    nodes.forEach((node, index) => {
      node.x = snap(80 + index * 300)
    })
  }

  const edges: FlowEdge[] = []
  for (const draft of parsed.edges ?? []) {
    const from = remap.get(String(draft.from))
    const to = remap.get(String(draft.to))
    // An edge pointing at a node that was dropped for being invalid is itself
    // invalid; silently skipping it beats a dangling arrow on the canvas.
    if (!from || !to || from === to) continue
    edges.push({ id: id(), from, to })
  }

  // A graph with no edges is a pile of boxes. Chain it in the order given.
  if (edges.length === 0) {
    for (let index = 0; index < nodes.length - 1; index += 1) {
      edges.push({ id: id(), from: nodes[index]!.id, to: nodes[index + 1]!.id })
    }
  }

  return { name: String(parsed.name ?? 'New automation'), nodes, edges }
}

/** The catalogue the canvas offers when adding a node by hand. */
export const paletteTools = (): { id: string; label: string; provider: string }[] =>
  ALL_TOOLS.filter((tool) => tool.provider).map((tool) => ({
    id: tool.id,
    label: tool.label,
    provider: tool.provider!
  }))

export const connectorName = (providerId: string): string =>
  CONNECTORS.find((entry) => entry.id === providerId)?.name ?? providerId
