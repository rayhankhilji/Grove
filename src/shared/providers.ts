/**
 * Model providers.
 *
 * Three ways to reach a model, and the agent loop cannot tell them apart:
 *
 *   api-key      Anthropic through the official SDK; everything else speaks the
 *                OpenAI chat-completions dialect, so one adapter covers Gemini,
 *                DeepSeek, Groq, OpenRouter and a local Ollama.
 *   subscription A Claude or ChatGPT plan you already pay for, reached through
 *                the vendor's own CLI on this Mac. No second bill.
 *   keyless      A local runtime that needs no credential at all.
 */

export type ProviderKind = 'anthropic' | 'openai-compatible'

/** How the user is paying for a provider right now. */
export type AuthMode = 'api' | 'subscription'

export interface ModelOption {
  id: string
  label: string
  note: string
  /** Adaptive thinking + the effort parameter. Anthropic current-gen only. */
  reasoning?: boolean
  /** Rough USD per million tokens, for the cost hint in the picker. */
  inPrice?: number
  outPrice?: number
  /** Reachable on the subscription plan as well as by API key. */
  onPlan?: boolean
}

/**
 * A plan reached through the vendor's own command-line tool.
 *
 * Grove never touches your login: the CLI is already signed in, holds its own
 * session, and bills against the plan you bought. We shell out to it and read
 * the answer back. That also means Grove inherits the plan's rate limits.
 */
export interface SubscriptionSpec {
  /** Executable on PATH. */
  command: string
  /** What the user calls the plan. */
  label: string
  /** Shown when the CLI is not installed. */
  install: string
  installUrl: string
  /** One line on how to sign in, shown under the connect button. */
  signIn: string
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
  /** Present when a paid plan can drive this provider instead of a key. */
  subscription?: SubscriptionSpec
  models: ModelOption[]
}

export const PROVIDERS: ProviderSpec[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'anthropic',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    subscription: {
      command: 'claude',
      label: 'Claude Pro or Max',
      install: 'npm install -g @anthropic-ai/claude-code',
      installUrl: 'https://claude.com/product/claude-code',
      signIn: 'Run `claude` once in a terminal and sign in. Grove uses that session.'
    },
    models: [
      { id: 'claude-opus-5', label: 'Opus 5', note: 'Deepest reasoning.', reasoning: true, inPrice: 5, outPrice: 25, onPlan: true },
      { id: 'claude-sonnet-5', label: 'Sonnet 5', note: 'Near-Opus, cheaper.', reasoning: true, inPrice: 3, outPrice: 15, onPlan: true },
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5', note: 'Fast and cheap.', inPrice: 1, outPrice: 5, onPlan: true }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    subscription: {
      command: 'codex',
      label: 'ChatGPT Plus, Pro or Business',
      install: 'npm install -g @openai/codex',
      installUrl: 'https://developers.openai.com/codex/cli',
      signIn: 'Run `codex` once and choose "Sign in with ChatGPT". Grove uses that session.'
    },
    models: [
      { id: 'gpt-5', label: 'GPT-5', note: 'Flagship.', inPrice: 1.25, outPrice: 10, onPlan: true },
      { id: 'gpt-5-codex', label: 'GPT-5 Codex', note: 'Tuned for agentic work.', inPrice: 1.25, outPrice: 10, onPlan: true },
      { id: 'gpt-5-mini', label: 'GPT-5 mini', note: 'Cheap and quick.', inPrice: 0.25, outPrice: 2 }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    keyUrl: 'https://platform.deepseek.com/api_keys',
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
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', note: 'Fast and capable.', inPrice: 0.59, outPrice: 0.79 },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', note: 'Near-instant.', inPrice: 0.05, outPrice: 0.08 },
      { id: 'moonshotai/kimi-k2-instruct', label: 'Kimi K2', note: 'Strong tool use.', inPrice: 1, outPrice: 3 }
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys',
    models: [
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3', note: 'Cheap default.', inPrice: 0.27, outPrice: 1.1 },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: 'Fast and cheap.', inPrice: 0.3, outPrice: 2.5 },
      { id: 'qwen/qwen3-235b-a22b', label: 'Qwen3 235B', note: 'Strong open weight.', inPrice: 0.2, outPrice: 0.8 },
      { id: 'openai/gpt-5', label: 'GPT-5', note: 'Routed.', inPrice: 1.25, outPrice: 10 }
    ]
  },
  {
    id: 'google',
    name: 'Google Gemini',
    kind: 'openai-compatible',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', note: '1M context.', inPrice: 0.3, outPrice: 2.5 },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', note: 'Their strongest.', inPrice: 1.25, outPrice: 10 }
    ]
  },
  {
    id: 'ollama',
    name: 'Ollama',
    kind: 'openai-compatible',
    baseUrl: 'http://127.0.0.1:11434/v1',
    keyUrl: '',
    keyless: true,
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

/** Providers that can run off a plan rather than a metered key. */
export const SUBSCRIBABLE = PROVIDERS.filter((provider) => provider.subscription)

/** Cheap-and-good default for high-volume autonomous work. */
export const WORKER_MODEL = 'deepseek-chat'
export const DEFAULT_MODEL = 'claude-opus-5'
