import Anthropic from '@anthropic-ai/sdk'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import { providerOfModel, modelOption } from '@shared/providers'
import { streamCompat } from './compat'
import { vault } from '../vault'

/** Keys for model providers live under their own namespace in the vault. */
export const llmKeyId = (providerId: string): string => `llm:${providerId}`

export class MissingProviderKey extends Error {
  constructor(public readonly providerName: string) {
    super(`No API key for ${providerName}. Add one in Settings → Providers.`)
  }
}

export interface TurnRequest {
  model: string
  system: string
  messages: Anthropic.MessageParam[]
  tools: Anthropic.Tool[]
  maxTokens: number
  effort: 'low' | 'medium' | 'high'
  showThinking?: boolean
  onText?: (chunk: string) => void
  onThinking?: (chunk: string) => void
  signal?: AbortSignal
}

export interface TurnResult {
  content: ContentBlockParam[]
  stopReason: 'tool_use' | 'end_turn' | 'refusal'
  tokensIn: number
  tokensOut: number
}

const anthropicKey = (): string => {
  // The Anthropic key predates the multi-provider layer, so accept either slot.
  const key = vault.getKey() ?? vault.provider(llmKeyId('anthropic')).accessToken
  if (!key) throw new MissingProviderKey('Anthropic')
  return key
}

/**
 * One turn against whichever provider owns the model. Claude goes through the
 * official SDK; everything else through the OpenAI-compatible adapter.
 */
export const runTurn = async (request: TurnRequest): Promise<TurnResult> => {
  const provider = providerOfModel(request.model)

  if (provider.kind === 'anthropic') {
    const client = new Anthropic({ apiKey: anthropicKey(), maxRetries: 2 })
    const supportsReasoning = modelOption(request.model)?.reasoning === true

    const stream = client.messages.stream({
      model: request.model,
      max_tokens: request.maxTokens,
      system: request.system,
      tools: request.tools,
      messages: request.messages,
      ...(supportsReasoning
        ? {
            thinking: {
              type: 'adaptive' as const,
              display: request.showThinking ? ('summarized' as const) : ('omitted' as const)
            },
            output_config: { effort: request.effort }
          }
        : {})
    })

    for await (const event of stream) {
      if (event.type !== 'content_block_delta') continue
      if (event.delta.type === 'text_delta') request.onText?.(event.delta.text)
      else if (event.delta.type === 'thinking_delta') request.onThinking?.(event.delta.thinking)
    }

    const response = await stream.finalMessage()
    return {
      content: response.content as unknown as ContentBlockParam[],
      stopReason:
        response.stop_reason === 'tool_use'
          ? 'tool_use'
          : response.stop_reason === 'refusal'
            ? 'refusal'
            : 'end_turn',
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens
    }
  }

  const key = vault.provider(llmKeyId(provider.id)).accessToken ?? ''
  if (!key && !provider.keyless) throw new MissingProviderKey(provider.name)

  const result = await streamCompat({
    baseUrl: provider.baseUrl!,
    apiKey: key,
    model: request.model,
    system: request.system,
    messages: request.messages,
    tools: request.tools,
    maxTokens: request.maxTokens,
    onText: request.onText,
    signal: request.signal
  })

  return {
    content: result.content,
    stopReason: result.stopReason,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut
  }
}

/** Non-streaming convenience for one-shot generations (briefings, summaries). */
export const complete = async (
  model: string,
  system: string,
  prompt: string,
  maxTokens = 2000
): Promise<string> => {
  const result = await runTurn({
    model,
    system,
    messages: [{ role: 'user', content: prompt }],
    tools: [],
    maxTokens,
    effort: 'high'
  })
  return result.content
    .filter((block): block is Anthropic.TextBlockParam => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

export const describeLlmError = (error: unknown): string => {
  if (error instanceof MissingProviderKey) return error.message
  if (error instanceof Anthropic.AuthenticationError)
    return 'That Anthropic key was rejected. Check it in Settings.'
  if (error instanceof Anthropic.PermissionDeniedError)
    return 'This key cannot use the selected model.'
  if (error instanceof Anthropic.RateLimitError)
    return 'Rate limited. Wait a moment and try again.'
  if (error instanceof Anthropic.APIConnectionError)
    return 'Could not reach the provider. Check your connection.'
  if (error instanceof Anthropic.APIError) return `API error (${error.status}): ${error.message}`
  return (error as Error)?.message ?? 'Something went wrong.'
}
