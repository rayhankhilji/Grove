import { vault } from '../vault'

/**
 * Fish Audio text-to-speech.
 *
 * Voices are chosen by the user from their own Fish account — either licensed
 * marketplace voices or models they created and hold the rights to. Grove maps
 * a voice id to a boardroom seat; it never creates or requests a clone of a
 * real person, and the personas are always labelled as interpretations.
 */

const BASE = 'https://api.fish.audio'
export const FISH_KEY_ID = 'voice:fish'

export interface FishVoice {
  id: string
  title: string
  author: string
  languages: string[]
  /** Fish marks whether a model may be used by others. */
  visibility: string
}

const key = (): string => {
  const token = vault.provider(FISH_KEY_ID).accessToken
  if (!token) throw new Error('No Fish Audio key. Add one in Settings → Voice.')
  return token
}

/** Lists voices available to this account, for the per-persona voice picker. */
export const listVoices = async (query: string): Promise<FishVoice[]> => {
  const params = new URLSearchParams({
    page_size: '30',
    page_number: '1',
    ...(query ? { title: query } : {})
  })

  const response = await fetch(`${BASE}/model?${params}`, {
    headers: { Authorization: `Bearer ${key()}` }
  })
  if (!response.ok) {
    throw new Error(`Fish Audio returned ${response.status}: ${(await response.text()).slice(0, 200)}`)
  }

  const body = (await response.json()) as {
    items?: {
      _id?: string
      id?: string
      title?: string
      author?: { nickname?: string }
      languages?: string[]
      visibility?: string
    }[]
  }

  return (body.items ?? []).map((item) => ({
    id: item._id ?? item.id ?? '',
    title: item.title ?? 'Untitled voice',
    author: item.author?.nickname ?? 'unknown',
    languages: item.languages ?? [],
    visibility: item.visibility ?? 'private'
  }))
}

/**
 * Renders one line of speech. Returns a data URL so the renderer can play it
 * without a filesystem round trip or a loosened CSP for local files.
 */
export const speak = async (text: string, voiceId: string): Promise<string> => {
  const response = await fetch(`${BASE}/v1/tts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key()}`,
      'Content-Type': 'application/json',
      // Fish selects the synthesis backend from this header.
      model: 's1'
    },
    body: JSON.stringify({
      text,
      reference_id: voiceId,
      format: 'mp3',
      mp3_bitrate: 128,
      normalize: true,
      latency: 'balanced'
    })
  })

  if (!response.ok) {
    throw new Error(`Fish Audio returned ${response.status}: ${(await response.text()).slice(0, 200)}`)
  }

  const audio = Buffer.from(await response.arrayBuffer())
  return `data:audio/mpeg;base64,${audio.toString('base64')}`
}

export const hasVoiceKey = (): boolean => Boolean(vault.provider(FISH_KEY_ID).accessToken)
