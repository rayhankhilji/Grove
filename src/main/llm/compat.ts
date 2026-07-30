import type Anthropic from '@anthropic-ai/sdk'

/**
 * Adapter for providers that speak the OpenAI chat-completions dialect.
 *
 * Anthropic's message shape stays the canonical internal format — it is richer,
 * and the agent loop is already written against it. This module translates at
 * the edge in both directions, so a run on DeepSeek or a local Ollama is
 * indistinguishable to the caller from a run on Claude.
 */

interface OpenAITool {
  type: 'function'
  function: { name: string; description: string; parameters: unknown }
}

type OpenAIMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | {
      role: 'assistant'
      content: string | null
      tool_calls: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
    }
  | { role: 'tool'; tool_call_id: string; content: string }

const textOf = (content: Anthropic.MessageParam['content']): string => {
  if (typeof content === 'string') return content
  return content
    .filter((block): block is Anthropic.TextBlockParam => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}

/**
 * Anthropic answers every tool_use inside one user turn; OpenAI wants one
 * `tool` message per call. This flattens that difference.
 */
const toOpenAIMessages = (
  system: string,
  messages: Anthropic.MessageParam[]
): OpenAIMessage[] => {
  const out: OpenAIMessage[] = [{ role: 'system', content: system }]

  for (const message of messages) {
    const blocks = typeof message.content === 'string' ? null : message.content

    if (message.role === 'assistant') {
      const toolUses = (blocks ?? []).filter(
        (block): block is Anthropic.ToolUseBlockParam => block.type === 'tool_use'
      )
      const text = textOf(message.content)

      if (toolUses.length > 0) {
        out.push({
          role: 'assistant',
          content: text || null,
          tool_calls: toolUses.map((use) => ({
            id: use.id,
            type: 'function',
            function: { name: use.name, arguments: JSON.stringify(use.input ?? {}) }
          }))
        })
      } else if (text) {
        out.push({ role: 'assistant', content: text })
      }
      continue
    }

    const results = (blocks ?? []).filter(
      (block): block is Anthropic.ToolResultBlockParam => block.type === 'tool_result'
    )
    for (const result of results) {
      out.push({
        role: 'tool',
        tool_call_id: result.tool_use_id,
        content:
          typeof result.content === 'string'
            ? result.content
            : (result.content ?? [])
                .map((part) => (part.type === 'text' ? part.text : ''))
                .join('\n')
      })
    }

    const text = textOf(message.content)
    if (text) out.push({ role: 'user', content: text })
  }

  return out
}

const toOpenAITools = (tools: Anthropic.Tool[]): OpenAITool[] =>
  tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.input_schema
    }
  }))

export interface CompatRequest {
  baseUrl: string
  apiKey: string
  model: string
  system: string
  messages: Anthropic.MessageParam[]
  tools: Anthropic.Tool[]
  maxTokens: number
  onText?: (chunk: string) => void
  signal?: AbortSignal
}

export interface CompatResult {
  content: Anthropic.ContentBlockParam[]
  stopReason: 'tool_use' | 'end_turn'
  tokensIn: number
  tokensOut: number
}

interface PartialCall {
  id: string
  name: string
  args: string
}

/** Streams a completion, emitting text as it lands and assembling tool calls. */
export const streamCompat = async (request: CompatRequest): Promise<CompatResult> => {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: toOpenAIMessages(request.system, request.messages),
    max_tokens: request.maxTokens,
    stream: true,
    // Not every provider honours this, so usage is treated as best-effort.
    stream_options: { include_usage: true }
  }
  if (request.tools.length > 0) body['tools'] = toOpenAITools(request.tools)

  const response = await fetch(`${request.baseUrl}/chat/completions`, {
    method: 'POST',
    signal: request.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(request.apiKey ? { Authorization: `Bearer ${request.apiKey}` } : {}),
      // OpenRouter attributes traffic with these; harmless elsewhere.
      'HTTP-Referer': 'https://github.com/rayhankhilji/grove',
      'X-Title': 'Grove'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `${new URL(request.baseUrl).host} returned ${response.status}: ${detail.slice(0, 300) || response.statusText}`
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const calls = new Map<number, PartialCall>()
  let text = ''
  let tokensIn = 0
  let tokensOut = 0
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by a blank line; keep the tail for next round.
    const frames = buffer.split('\n')
    buffer = frames.pop() ?? ''

    for (const frame of frames) {
      const line = frame.trim()
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue

      let event: any
      try {
        event = JSON.parse(payload)
      } catch {
        continue
      }

      if (event.usage) {
        tokensIn = event.usage.prompt_tokens ?? tokensIn
        tokensOut = event.usage.completion_tokens ?? tokensOut
      }

      const delta = event.choices?.[0]?.delta
      if (!delta) continue

      if (typeof delta.content === 'string' && delta.content) {
        text += delta.content
        request.onText?.(delta.content)
      }

      for (const call of delta.tool_calls ?? []) {
        const index = call.index ?? 0
        const existing = calls.get(index) ?? { id: '', name: '', args: '' }
        calls.set(index, {
          id: call.id || existing.id,
          name: call.function?.name || existing.name,
          // Arguments arrive as a JSON string in fragments.
          args: existing.args + (call.function?.arguments ?? '')
        })
      }
    }
  }

  const content: Anthropic.ContentBlockParam[] = []
  if (text) content.push({ type: 'text', text })

  for (const [index, call] of [...calls.entries()].sort((a, b) => a[0] - b[0])) {
    let input: unknown = {}
    try {
      input = call.args ? JSON.parse(call.args) : {}
    } catch {
      // A truncated or malformed argument stream should not kill the turn;
      // the tool layer reports the bad input back to the model instead.
      input = {}
    }
    content.push({
      type: 'tool_use',
      id: call.id || `call_${index}`,
      name: call.name,
      input
    })
  }

  return {
    content,
    stopReason: calls.size > 0 ? 'tool_use' : 'end_turn',
    tokensIn,
    tokensOut
  }
}
