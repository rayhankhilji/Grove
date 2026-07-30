/**
 * Compatibility surface over the provider catalogue: a flat model list for
 * pickers that do not care which vendor serves a model.
 */
import { ALL_MODELS, DEFAULT_MODEL, modelOption, providerOfModel } from './providers'
import type { ModelOption } from './providers'

export type { ModelOption }
export { DEFAULT_MODEL, providerOfModel }

export const MODELS: (ModelOption & { provider: string })[] = ALL_MODELS().map(
  ({ provider, model }) => ({ ...model, provider: provider.name })
)

export const modelFor = (id: string): ModelOption =>
  modelOption(id) ?? { id, label: id, note: '', reasoning: false }
