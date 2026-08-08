import type Anthropic from '@anthropic-ai/sdk'
import { runTurn } from '../llm'
import { WORKER_MODEL } from '@shared/providers'
import { store } from '../store'

/**
 * A worker: one job, no conversation, no memory, no user.
 *
 * This is what makes a pipeline real rather than described. An agent that says
 * "one sub-agent finds flights, another picks hotels, a manager reviews them"
 * is writing fiction unless something actually runs those three. `run_workers`
 * fans out to this, and the calling agent reads all the answers back at once.
 *
 * Workers get read-only tools deliberately. They are spawned by a model from a
 * brief the user never saw, so letting one send mail would mean an unreviewed
 * prompt could reach the outside world.
 */

const MAX_STEPS = 8
const MAX_TOKENS = 8000

const READ_ONLY = new Set(['web.render', 'web.fetch', 'review', 'brain_search', 'mac.attention'])

export const runWorker = async (brief: string): Promise<string> => {
  const { definitionsFor, ALL_TOOLS, runToolByWireName } = await import('../tools')
  const tools = ALL_TOOLS.filter((tool) => READ_ONLY.has(tool.id) || (tool.provider && !tool.write))
  const definitions = definitionsFor(tools)

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: brief }]
  let text = ''

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const response = await runTurn({
      // Workers run on the cheap model by default: there may be four of them
      // per turn, and their job is retrieval rather than judgement.
      model: store.get().settings.boardroomModel || WORKER_MODEL,
      system: `You are a research worker. You have exactly one job, stated below. Do it and report.

Rules:
- Use your tools to find real information. Never invent a price, a date, a name or a link.
- For anything whose results load after the page does — flights, hotels, listings, search results — use web.render, not web.fetch.
- If you cannot find something, say so plainly and say what you tried. A short honest answer beats a long invented one.
- Report findings only. No preamble, no offers to help further, no questions.`,
      tools: definitions,
      messages,
      maxTokens: MAX_TOKENS,
      effort: 'low',
      onText: (chunk) => {
        text += chunk
      }
    })

    messages.push({ role: 'assistant', content: response.content })
    if (response.stopReason !== 'tool_use') break

    const uses = response.content.filter(
      (block): block is Anthropic.ToolUseBlockParam => block.type === 'tool_use'
    )
    const results: Anthropic.ToolResultBlockParam[] = []
    for (const use of uses) {
      const outcome = await runToolByWireName(use.name, (use.input ?? {}) as Record<string, unknown>)
      results.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: outcome.result,
        is_error: outcome.isError
      })
    }
    messages.push({ role: 'user', content: results })
  }

  return text.trim()
}
