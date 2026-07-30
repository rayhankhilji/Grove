/**
 * Model providers.
 *
 * Claude runs on the official Anthropic SDK. Everything else speaks the
 * OpenAI chat-completions dialect — including Gemini, DeepSeek, Groq,
 * OpenRouter and a local Ollama — so one adapter covers the cheap end of the
 * market without a separate client per vendor.
 */

export type ProviderKind = 'anthropic' | 'openai-compatible'

export interface ModelOption {
  id: string
  label: string
  note: string
  /** Adaptive thinking + the effort parameter. Anthropic current-gen only. */
  reasoning?: boolean
  /** Rough USD per million tokens, for the cost hint in the picker. */
  inPrice?: number
  outPrice?: number
}

export interface ProviderSpec {
  id: string
  name: string
  kind: ProviderKind
  /** OpenAI-compatible base URL, ending at /v1. */
  baseUrl?: string
  /** Where the user gets a key. Empty for providers that need none. */
  keyUrl: string
  /** Local runtimes need no credential at all. */
  keyless?: boolean
  blurb: string
  models: ModelOption[]
}

export const PROVIDERS: ProviderSpec[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    blurb: 'Deepest judgement. What the standing team runs on by default.',
    models: [
      { id: 'claude-opus-5', label: 'Opus 5', note: 'Best reasoning.', reasoning: true, inPrice: 5, outPrice: 25 },
      { id: 'claude-sonnet-5', label: 'Sonnet 5', note: 'Near-Opus, cheaper.', reasoning: true, inPrice: 3, outPrice: 15 },
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5', note: 'Fast and cheap.', inPrice: 1, outPrice: 5 }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    blurb: 'The cheapest capable option. Strong at code and long reasoning.',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek V3', note: 'Cheap workhorse.', inPrice: 0.27, outPrice: 1.1 },
      { id: 'deepseek-reasoner', label: 'DeepSeek R1', note: 'Reasoning, still cheap.', inPrice: 0.55, outPrice: 2.19 }
    ]
  },
  {
    id: 'groq',
    name: 'Groq',
    kind: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyUrl: 'https://console.groq.com/keys',
    blurb: 'Absurdly fast inference. Ideal for boardroom turn-taking.',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', note: 'Fast, capable, cheap.', inPrice: 0.59, outPrice: 0.79 },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', note: 'Near-instant, pennies.', inPrice: 0.05, outPrice: 0.08 },
      { id: 'moonshotai/kimi-k2-instruct', label: 'Kimi K2', note: 'Strong agentic tool use.', inPrice: 1, outPrice: 3 }
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys',
    blurb: 'One key, hundreds of models. Good for shopping on price.',
    models: [
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3', note: 'Cheap default.', inPrice: 0.27, outPrice: 1.1 },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Fast and very cheap.', inPrice: 0.3, outPrice: 2.5 },
      { id: 'qwen/qwen3-235b-a22b', label: 'Qwen3 235B', note: 'Strong open weight.', inPrice: 0.2, outPrice: 0.8 },
      { id: 'openai/gpt-5', label: 'GPT-5', note: 'Via OpenRouter.', inPrice: 1.25, outPrice: 10 }
    ]
  },
  {
    id: 'google',
    name: 'Google Gemini',
    kind: 'openai-compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyUrl: 'https://aistudio.google.com/apikey',
    blurb: 'Huge context windows and a generous free tier.',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Cheap, 1M context.', inPrice: 0.3, outPrice: 2.5 },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', note: 'Their strongest.', inPrice: 1.25, outPrice: 10 }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    blurb: 'GPT models, if you already have a key.',
    models: [
      { id: 'gpt-5', label: 'GPT-5', note: 'Their flagship.', inPrice: 1.25, outPrice: 10 },
      { id: 'gpt-5-mini', label: 'GPT-5 mini', note: 'Cheap and quick.', inPrice: 0.25, outPrice: 2 }
    ]
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    kind: 'openai-compatible',
    baseUrl: 'http://127.0.0.1:11434/v1',
    keyUrl: '',
    keyless: true,
    blurb: 'Runs on this Mac. Free, private, no network. Needs Ollama installed.',
    models: [
      { id: 'llama3.2', label: 'Llama 3.2', note: 'Small and local.', inPrice: 0, outPrice: 0 },
      { id: 'qwen2.5:14b', label: 'Qwen 2.5 14B', note: 'Local, more capable.', inPrice: 0, outPrice: 0 }
    ]
  }
]

export const providerFor = (id: string): ProviderSpec =>
  PROVIDERS.find((provider) => provider.id === id) ?? PROVIDERS[0]!

/** Finds which provider serves a model id, for agents that only store a model. */
export const providerOfModel = (modelId: string): ProviderSpec =>
  PROVIDERS.find((provider) => provider.models.some((model) => model.id === modelId)) ?? PROVIDERS[0]!

export const modelOption = (modelId: string): ModelOption | undefined =>
  PROVIDERS.flatMap((provider) => provider.models).find((model) => model.id === modelId)

export const ALL_MODELS = (): { provider: ProviderSpec; model: ModelOption }[] =>
  PROVIDERS.flatMap((provider) => provider.models.map((model) => ({ provider, model })))

/** Cheap-and-good default for high-volume autonomous work. */
export const WORKER_MODEL = 'deepseek-chat'
export const DEFAULT_MODEL = 'claude-opus-5'
