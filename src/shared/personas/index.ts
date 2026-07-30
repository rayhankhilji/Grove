import house from './_house.md?raw'
import graham from './graham.md?raw'
import jobs from './jobs.md?raw'
import altman from './altman.md?raw'
import naval from './naval.md?raw'
import karpathy from './karpathy.md?raw'
import munger from './munger.md?raw'
import collison from './collison.md?raw'
import bezos from './bezos.md?raw'

/**
 * The bench.
 *
 * Each adviser is authored as a markdown file rather than a config object, so
 * the thing that actually shapes behaviour — the prose — is editable, reviewable
 * in a diff, and long enough to encode a real point of view. Frontmatter
 * carries only what the UI needs; the body is injected verbatim into the seat's
 * system prompt.
 */

export interface Persona {
  id: string
  name: string
  /** What they are known for — shown under the name. */
  known: string
  domain: string
  tint: string
  /** One line on what this seat is for, shown in the picker. */
  brief: string
  /** The full markdown body, minus frontmatter. */
  body: string
}

/** Minimal frontmatter reader — these files are ours, so no parser needed. */
const parse = (source: string): Persona => {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source.trim())
  if (!match) throw new Error('Persona file is missing frontmatter.')

  const [, head, body] = match
  const fields: Record<string, string> = {}
  for (const line of head!.split('\n')) {
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    fields[key] = value
  }

  return {
    id: fields['id'] ?? '',
    name: fields['name'] ?? '',
    known: fields['known'] ?? '',
    domain: fields['domain'] ?? '',
    tint: fields['tint'] ?? '#4ec5b6',
    brief: fields['brief'] ?? '',
    body: body!.trim()
  }
}

export const HOUSE_RULES = house.trim()

export const PERSONAS: Persona[] = [
  graham,
  jobs,
  altman,
  naval,
  karpathy,
  munger,
  collison,
  bezos
].map(parse)

export const DOMAINS: string[] = [...new Set(PERSONAS.map((persona) => persona.domain))]

export const personaFor = (id: string): Persona | undefined =>
  PERSONAS.find((persona) => persona.id === id)

/** Shown wherever a persona appears, and stated by the seats themselves. */
export const PERSONA_DISCLAIMER =
  'Interpretations of publicly documented thinking. Not the real people, not their words, not endorsed by them.'
