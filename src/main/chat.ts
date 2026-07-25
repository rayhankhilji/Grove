import type Anthropic from '@anthropic-ai/sdk'
import type { AgentEvent, Conversation, Message, ToolCall } from '@shared/types'
import { execute, explain, client } from './agents/runtime'
import { snapshot } from './tools'
import { id, now, store, today } from './store'

/**
 * Prior turns replay as plain text rather than tool_use/tool_result pairs.
 * Everything those tools changed is already in the state snapshot the system
 * prompt carries, so replaying them is redundant context and an easy source of
 * pairing errors.
 */
const history = (conversation: Conversation): Anthropic.MessageParam[] =>
  conversation.messages
    .filter((message) => message.text.trim().length > 0)
    .map((message) => ({ role: message.role, content: message.text }))

export const chat = async (
  conversationId: string,
  text: string,
  emit: (event: AgentEvent) => void
): Promise<void> => {
  const state = store.get()
  const conversation = state.conversations.find((entry) => entry.id === conversationId)
  if (!conversation) {
    emit({ type: 'chat.error', message: 'That conversation no longer exists.' })
    return
  }

  const agent =
    state.agents.find((candidate) => candidate.id === conversation.agentId) ?? state.agents[0]
  if (!agent) {
    emit({ type: 'chat.error', message: 'No agent is configured.' })
    return
  }

  const userMessage: Message = {
    id: id(),
    role: 'user',
    text,
    thinking: '',
    toolCalls: [],
    model: agent.model,
    agentId: agent.id,
    createdAt: now()
  }

  const reply: Message = {
    id: id(),
    role: 'assistant',
    text: '',
    thinking: '',
    toolCalls: [],
    model: agent.model,
    agentId: agent.id,
    createdAt: now()
  }

  store.update(() => {
    conversation.messages.push(userMessage)
    if (conversation.title === 'New conversation') {
      conversation.title = text.slice(0, 52).trim() || 'New conversation'
    }
    conversation.updatedAt = now()
  })

  emit({ type: 'chat.start', conversationId, messageId: reply.id })
  emit({ type: 'state', state: store.get() })

  const messages: Anthropic.MessageParam[] = [
    ...history(conversation).slice(0, -1),
    { role: 'user', content: text }
  ]

  try {
    const result = await execute(agent, messages, {
      onText: (chunk) => {
        reply.text += chunk
        emit({ type: 'chat.text', text: chunk })
      },
      onThinking: (chunk) => {
        reply.thinking += chunk
        emit({ type: 'chat.thinking', text: chunk })
      },
      onTool: (call: ToolCall) => {
        reply.toolCalls.push(call)
        emit({ type: 'chat.tool', call })
        emit({ type: 'state', state: store.get() })
      },
      onApproval: (pending) =>
        emit({
          type: 'chat.approval',
          pending: pending
            ? { key: pending.key, summary: pending.summary, toolName: pending.toolName }
            : null
        })
    })

    if (!result.text.trim() && result.toolCalls.length === 0) {
      reply.text = 'I did not get a response that time. Try again.'
    }
  } catch (error) {
    const message = explain(error)
    emit({ type: 'chat.error', message })
    reply.text ||= `⚠︎ ${message}`
  }

  const finalState = store.update(() => {
    conversation.messages.push(reply)
    conversation.updatedAt = now()
  })
  emit({ type: 'chat.done', state: finalState })
}

/** Generates today's briefing. Read-only by design — no tools. */
export const generateBriefing = async (): Promise<string> => {
  const state = store.get()
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })

  const prompt = `Write ${state.profile.name ? `${state.profile.name}'s` : 'the'} briefing for ${date}.

Four short sections, in this order, using \`## \` headers:

## The call
One sentence. The single most important thing to do today, stated as an instruction.

## Where things stand
Two or three lines on objectives that moved, stalled, or are about to slip. Cite the actual numbers. If an objective has had no progress recorded in a while, say that.

## Today
Three to five open tasks worth doing today, as a list. Pick them — do not dump everything marked "now".

## Watch
One thing being neglected, avoided, or drifting. Be direct. If there is genuinely nothing, say "Nothing drifting." and stop.

Write it as their CEO: terse, specific, no hedging, no encouragement. Never invent facts that are not in the state below.

${snapshot(state)}`

  const response = await client().messages.create({
    model: state.settings.model,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  })

  const body = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()

  store.update((draft) => {
    const key = today()
    const entry = { date: key, body, generatedAt: now() }
    const index = draft.briefings.findIndex((briefing) => briefing.date === key)
    if (index >= 0) draft.briefings[index] = entry
    else draft.briefings.push(entry)
  })

  return body
}
