import type { BrainEntry } from '@shared/types'
import { id, now, store } from './store'

/**
 * The company brain.
 *
 * A single collected context layer that everything reads from: agents, chat and
 * every boardroom seat. The point is that you explain something once — your
 * positioning, your pricing, last quarter's numbers, the investor update — and
 * it is present in every room after that, instead of being retyped into a
 * prompt each time.
 */

const MAX_INJECT_CHARS = 9000

export const addEntry = (
  title: string,
  body: string,
  source: string,
  tags: string[] = []
): BrainEntry => {
  const entry: BrainEntry = {
    id: id(),
    title: title.trim() || 'Untitled',
    body: body.trim(),
    source,
    tags,
    pinned: false,
    createdAt: now(),
    updatedAt: now()
  }
  store.update((state) => {
    state.brain.unshift(entry)
  })
  return entry
}

export const updateEntry = (entryId: string, patch: Partial<BrainEntry>): void => {
  store.update((state) => {
    const index = state.brain.findIndex((entry) => entry.id === entryId)
    const existing = state.brain[index]
    if (existing) state.brain[index] = { ...existing, ...patch, updatedAt: now() }
  })
}

export const removeEntry = (entryId: string): void => {
  store.update((state) => {
    state.brain = state.brain.filter((entry) => entry.id !== entryId)
  })
}

/** Word-overlap scoring. Small corpora do not justify an embedding index. */
const score = (entry: BrainEntry, terms: string[]): number => {
  const haystack = `${entry.title} ${entry.tags.join(' ')} ${entry.body}`.toLowerCase()
  let total = 0
  for (const term of terms) {
    if (!term) continue
    // Title and tag hits are worth far more than a mention deep in the body.
    if (entry.title.toLowerCase().includes(term)) total += 6
    if (entry.tags.some((tag) => tag.toLowerCase().includes(term))) total += 4
    const occurrences = haystack.split(term).length - 1
    total += Math.min(occurrences, 5)
  }
  return total
}

export const search = (query: string, limit = 6): BrainEntry[] => {
  const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2)
  if (terms.length === 0) return store.get().brain.slice(0, limit)

  return store
    .get()
    .brain.map((entry) => ({ entry, value: score(entry, terms) }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((row) => row.entry)
}

/**
 * The slice of the brain that rides along in a system prompt: everything
 * pinned, then whatever the brief matches, trimmed to a sane budget.
 */
export const context = (query = ''): string => {
  const brain = store.get().brain
  if (brain.length === 0) return ''

  const pinned = brain.filter((entry) => entry.pinned)
  const matched = search(query, 6).filter((entry) => !entry.pinned)
  const chosen = [...pinned, ...matched]
  if (chosen.length === 0) return ''

  const parts: string[] = []
  let budget = MAX_INJECT_CHARS

  for (const entry of chosen) {
    const block = `### ${entry.title}${entry.source ? ` _(${entry.source})_` : ''}\n${entry.body}`
    if (block.length > budget) {
      parts.push(`${block.slice(0, Math.max(0, budget))}\n…[trimmed]`)
      break
    }
    parts.push(block)
    budget -= block.length
  }

  return parts.join('\n\n')
}

export const brainTools = {
  search: (input: Record<string, any>): string => {
    const results = search(String(input.query ?? ''), Math.min(Number(input.limit) || 5, 10))
    if (results.length === 0) return 'Nothing in the company brain matches that.'
    return results
      .map((entry) => `### ${entry.title}${entry.source ? ` (${entry.source})` : ''}\n${entry.body.slice(0, 1500)}`)
      .join('\n\n')
  },

  add: (input: Record<string, any>): string => {
    const entry = addEntry(
      String(input.title),
      String(input.body),
      'agent',
      String(input.tags ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
    return `Filed "${entry.title}" in the company brain.`
  }
}
