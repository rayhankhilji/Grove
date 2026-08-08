import type Anthropic from '@anthropic-ai/sdk'
import type { Agent, AppState, Run, RunStep, ToolCall } from '@shared/types'
import { HOUSE_RULES } from '@shared/agents'
import { snapshot, definitionsFor, runToolByWireName, toolById, toolsForAgent, type ToolDef } from '../tools'
import { describeLlmError, runTurn } from '../llm'
import { context as brainContext } from '../brain'
import { id, now, store } from '../store'

const MAX_STEPS = 16
const MAX_TOKENS = 16000
/** Guards against agents handing work back and forth forever. */
const MAX_HANDOFF_DEPTH = 3

/** Errors from any provider, translated into something worth reading. */
export const explain = describeLlmError

/* ── Approvals ───────────────────────────────────────────────────────────── */

const waiting = new Map<string, (approved: boolean) => void>()

/** Blocks the loop until the UI answers. Resolved by `settleApproval`. */
const requestApproval = (key: string): Promise<boolean> =>
  new Promise((resolve) => waiting.set(key, resolve))

export const settleApproval = (key: string, approved: boolean): void => {
  waiting.get(key)?.(approved)
  waiting.delete(key)
}

/** Anything with a side effect outside this Mac needs a human yes. */
const needsApproval = (agent: Agent, tool?: ToolDef): boolean =>
  agent.autonomy === 'supervised' && Boolean(tool?.write && tool.provider)

const describeAction = (tool: ToolDef, input: Record<string, unknown>): string => {
  const notable = ['to', 'channel', 'title', 'subject', 'repo', 'text', 'content']
  const detail = notable
    .filter((key) => input[key])
    .map((key) => `${key}: ${String(input[key]).slice(0, 120)}`)
    .join(' · ')
  return detail ? `${tool.label} — ${detail}` : tool.label
}

/* ── System prompt ───────────────────────────────────────────────────────── */

export const systemFor = (agent: Agent, state: AppState): string => {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  return `You are ${agent.name}, part of the standing team that runs ${
    state.profile.name ? `${state.profile.name}'s` : 'the principal’s'
  } work. Your remit: ${agent.role}.

Today is ${date}.

${agent.instructions}

---

${HOUSE_RULES}

## Also

Never claim you have done something a tool did not actually confirm. When a task
belongs to a teammate, hand it off — you get their finished work back and can
build on it. If a tool failed or returned nothing, say so plainly rather than
inventing a plausible answer.

## The principal's own data

Everything below was entered by the principal. It is fact. Use it directly.

${snapshot(state)}${
    brainContext(agent.role) ? `\n\n## What you already know about this company\n\n${brainContext(agent.role)}` : ''
  }`
}

/* ── Execution ───────────────────────────────────────────────────────────── */

export interface ExecHooks {
  onThinking?: (text: string) => void
  onText?: (text: string) => void
  onTool?: (call: ToolCall) => void
  onApproval?: (pending: { key: string; summary: string; toolName: string; input: Record<string, unknown> } | null) => void
  onHandoff?: (toAgent: Agent, task: string, runId: string) => void
}

export interface ExecResult {
  text: string
  toolCalls: ToolCall[]
  tokensIn: number
  tokensOut: number
}

const HANDOFF_SCHEMA = {
  type: 'object',
  properties: {
    agent: { type: 'string', description: 'Name or id of the teammate to hand this to.' },
    task: { type: 'string', description: 'Self-contained instruction. They cannot see this conversation.' }
  },
  required: ['agent', 'task']
} as Anthropic.Tool['input_schema']

/**
 * One agent turn: stream, run tools, honour approvals, recurse on handoffs.
 * Shared by chat and by background runs so both behave identically.
 */
export const execute = async (
  agent: Agent,
  messages: Anthropic.MessageParam[],
  hooks: ExecHooks,
  depth = 0
): Promise<ExecResult> => {
  const tools = toolsForAgent(agent)
  const state = store.get()

  const peers = state.agents.filter(
    (candidate) => agent.handoffIds.includes(candidate.id) && candidate.id !== agent.id
  )
  const canHandoff = peers.length > 0 && depth < MAX_HANDOFF_DEPTH

  const definitions = [...definitionsFor(tools)]
  if (canHandoff) {
    definitions.push({
      name: 'handoff',
      description: `Hand a task to a teammate and get their finished work back. Available: ${peers
        .map((peer) => `${peer.name} (${peer.role})`)
        .join('; ')}.`,
      input_schema: HANDOFF_SCHEMA
    })
  }

  const collected: ToolCall[] = []
  let text = ''
  let tokensIn = 0
  let tokensOut = 0

  for (let step = 0; step < MAX_STEPS; step += 1) {
    // The system prompt is rebuilt each step so the model sees what its own
    // tools just changed.
    const response = await runTurn({
      model: agent.model,
      system: systemFor(agent, store.get()),
      tools: definitions,
      messages,
      maxTokens: MAX_TOKENS,
      effort: agent.effort,
      showThinking: store.get().settings.showThinking,
      // On a plan the CLI runs the loop, so its calls arrive here rather than
      // through the tool_use branch below. Recording them keeps the trail
      // honest about what actually ran.
      onTool: (name, input) => {
        const tool = toolById(name.replace(/^mcp__grove__/, '').replace(/__/g, '.'))
        hooks.onTool?.({
          id: `${name}-${Date.now()}`,
          name: tool?.id ?? name,
          input,
          result: '',
          isError: false
        })
      },
      onText: (chunk) => {
        text += chunk
        hooks.onText?.(chunk)
      },
      onThinking: (chunk) => hooks.onThinking?.(chunk)
    })

    tokensIn += response.tokensIn
    tokensOut += response.tokensOut
    messages.push({ role: 'assistant', content: response.content })

    if (response.stopReason === 'refusal') {
      text ||= 'I can’t help with that one.'
      break
    }
    if (response.stopReason !== 'tool_use') break

    const uses = response.content.filter(
      (block): block is Anthropic.ToolUseBlockParam => block.type === 'tool_use'
    )

    // Approval is decided for the whole batch, so a turn can never half-execute.
    const gated = uses
      .map((use) => ({ use, tool: tools.find((candidate) => candidate.id === use.name.replace(/__/g, '.')) }))
      .filter((entry) => needsApproval(agent, entry.tool))

    let approved = true
    if (gated.length > 0) {
      const key = id()
      const summary = gated
        .map((entry) => describeAction(entry.tool!, (entry.use.input ?? {}) as Record<string, unknown>))
        .join('\n')
      const first = gated[0]!
      hooks.onApproval?.({
        key,
        summary,
        toolName: first.tool!.label,
        input: (first.use.input ?? {}) as Record<string, unknown>
      })
      approved = await requestApproval(key)
      hooks.onApproval?.(null)
    }

    const results: Anthropic.ToolResultBlockParam[] = []

    for (const use of uses) {
      const input = (use.input ?? {}) as Record<string, unknown>

      if (use.name === 'handoff') {
        const target = peers.find(
          (peer) =>
            peer.id === String(input.agent) ||
            peer.name.toLowerCase() === String(input.agent).toLowerCase() ||
            peer.name.toLowerCase().includes(String(input.agent).toLowerCase())
        )
        if (!target) {
          results.push({
            type: 'tool_result',
            tool_use_id: use.id,
            content: `No teammate matches "${String(input.agent)}".`,
            is_error: true
          })
          continue
        }

        const child = await startRun({
          agent: target,
          input: String(input.task),
          trigger: 'handoff',
          triggeredBy: agent.name,
          depth: depth + 1
        })
        hooks.onHandoff?.(target, String(input.task), child.id)

        const call: ToolCall = {
          id: use.id,
          name: 'handoff',
          input,
          result: child.output || child.error || 'No output.',
          isError: child.status === 'failed'
        }
        collected.push(call)
        hooks.onTool?.(call)
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: `${target.name} reports:\n\n${child.output || child.error || '(no output)'}`,
          is_error: child.status === 'failed'
        })
        continue
      }

      const isGated = gated.some((entry) => entry.use.id === use.id)
      if (isGated && !approved) {
        const call: ToolCall = {
          id: use.id,
          name: use.name.replace(/__/g, '.'),
          input,
          result: 'Declined by the principal.',
          isError: true
        }
        collected.push(call)
        hooks.onTool?.(call)
        results.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: 'The principal declined this action. Do not retry it; tell them plainly and offer an alternative.',
          is_error: true
        })
        continue
      }

      const { result, isError } = await runToolByWireName(use.name, input)
      const call: ToolCall = { id: use.id, name: use.name.replace(/__/g, '.'), input, result, isError }
      collected.push(call)
      hooks.onTool?.(call)
      results.push({ type: 'tool_result', tool_use_id: use.id, content: result, is_error: isError })
    }

    // Every tool_use block must be answered in a single user message.
    messages.push({ role: 'user', content: results })
  }

  return { text, toolCalls: collected, tokensIn, tokensOut }
}

/* ── Runs ────────────────────────────────────────────────────────────────── */

type RunListener = (run: Run) => void
const listeners = new Set<RunListener>()

export const onRunUpdate = (listener: RunListener): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const publish = (run: Run): void => {
  for (const listener of listeners) listener(run)
}

const addStep = (run: Run, step: Omit<RunStep, 'id' | 'at'>): void => {
  store.update(() => {
    run.steps.push({ ...step, id: id(), at: now() })
  })
  publish(run)
}

export interface StartRunOptions {
  agent: Agent
  input: string
  trigger: Run['trigger']
  triggeredBy: string
  parentRunId?: string | null
  workflowRunId?: string | null
  depth?: number
}

/**
 * Creates a Run record and executes it to completion. Handoffs call this
 * recursively, so a nested run shows up in the UI like any other.
 */
export const startRun = async (options: StartRunOptions): Promise<Run> => {
  const { agent, input, trigger, triggeredBy, depth = 0 } = options

  const run: Run = {
    id: id(),
    agentId: agent.id,
    agentName: agent.name,
    trigger,
    triggeredBy,
    input,
    output: '',
    status: 'running',
    steps: [],
    pending: null,
    parentRunId: options.parentRunId ?? null,
    workflowRunId: options.workflowRunId ?? null,
    tokensIn: 0,
    tokensOut: 0,
    startedAt: now(),
    endedAt: null,
    error: null
  }

  store.update((state) => {
    state.runs.unshift(run)
    // Keep history bounded so the state file stays small over months of use.
    if (state.runs.length > 200) state.runs.length = 200
  })
  publish(run)

  try {
    const result = await execute(
      agent,
      [{ role: 'user', content: input }],
      {
        onThinking: () => {
          /* reasoning is summarised into steps, not stored verbatim */
        },
        onTool: (call) =>
          addStep(run, {
            kind: 'tool',
            label: call.name === 'handoff' ? 'Handed off' : call.name,
            detail: call.result.slice(0, 600),
            tool: call
          }),
        onHandoff: (target, task, spawnedRunId) =>
          addStep(run, {
            kind: 'handoff',
            label: `Handed to ${target.name}`,
            detail: task,
            spawnedRunId
          }),
        onApproval: (pending) => {
          store.update(() => {
            run.pending = pending
              ? {
                  stepId: pending.key,
                  toolName: pending.toolName,
                  summary: pending.summary,
                  input: pending.input
                }
              : null
            run.status = pending ? 'awaiting_approval' : 'running'
          })
          publish(run)
        }
      },
      depth
    )

    store.update(() => {
      run.output = result.text
      run.tokensIn = result.tokensIn
      run.tokensOut = result.tokensOut
      run.status = 'succeeded'
      run.endedAt = now()
      run.pending = null
    })
    addStep(run, { kind: 'text', label: 'Finished', detail: result.text.slice(0, 600) })
  } catch (error) {
    const message = explain(error)
    store.update(() => {
      run.status = 'failed'
      run.error = message
      run.endedAt = now()
      run.pending = null
    })
    addStep(run, { kind: 'error', label: 'Failed', detail: message })
  }

  publish(run)
  return run
}

export const cancelRun = (runId: string): void => {
  const run = store.get().runs.find((candidate) => candidate.id === runId)
  if (!run || run.status === 'succeeded' || run.status === 'failed') return
  if (run.pending) settleApproval(run.pending.stepId, false)
  store.update(() => {
    run.status = 'cancelled'
    run.endedAt = now()
    run.pending = null
  })
  publish(run)
}
