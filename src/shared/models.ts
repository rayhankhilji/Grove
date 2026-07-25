export interface ModelOption {
  id: string
  label: string
  note: string
  /**
   * Adaptive thinking and the effort parameter are current-generation only.
   * Sending either to an older model is rejected with a 400, so the agent
   * gates both on this flag rather than assuming.
   */
  reasoning: boolean
}

/**
 * Models Stobs runs on. Ordered by capability — the default is the top entry,
 * because a personal CEO is a judgement job before it is a throughput job.
 */
export const MODELS: ModelOption[] = [
  { id: 'claude-opus-5', label: 'Opus 5', note: 'Deepest judgement. The default.', reasoning: true },
  {
    id: 'claude-sonnet-5',
    label: 'Sonnet 5',
    note: 'Near-Opus quality, faster and cheaper.',
    reasoning: true
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Haiku 4.5',
    note: 'Fastest. Best for quick capture.',
    reasoning: false
  }
]

export const DEFAULT_MODEL = 'claude-opus-5'

export const modelFor = (id: string): ModelOption => MODELS.find((m) => m.id === id) ?? MODELS[0]!
