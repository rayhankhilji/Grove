import type { ReactNode } from 'react'

/**
 * Provider marks.
 *
 * Only logos whose geometry can be reproduced exactly live here — Google's
 * four arcs, Microsoft's squares, the GitHub cat, the X, the Vercel triangle.
 * Everything else gets a monogram in that brand's real colour instead.
 *
 * That is a deliberate line. An approximated logo reads as a counterfeit and
 * makes the whole list look fake; a letter in the right colour reads as a
 * considered placeholder. Drop an accurate path in here and it takes over
 * automatically.
 */
const MARKS: Record<string, (size: number) => ReactNode> = {
  google: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-2.8-.4-4H24v7.3h12.1c-.2 2-1.6 5-4.5 7l-.1.3 6.5 5 .5.1c4.1-3.8 6.6-9.4 6.6-15.7z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-.3.1-6.8 5.2-.1.3C7.9 41.1 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4v-.3l-6.9-5.3-.2.1a22 22 0 0 0 0 19.8l7.1-5.5z"
      />
      <path
        fill="#EA4335"
        d="M24 10.1c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.9 29.9 1.9 24 1.9 15.4 1.9 7.9 6.8 4.4 14.1l7.1 5.5C13.3 14.2 18.2 10.1 24 10.1z"
      />
    </svg>
  ),

  microsoft: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#F25022" d="M6 6h17v17H6z" />
      <path fill="#7FBA00" d="M25 6h17v17H25z" />
      <path fill="#00A4EF" d="M6 25h17v17H6z" />
      <path fill="#FFB900" d="M25 25h17v17H25z" />
    </svg>
  ),

  linkedin: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="6" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M15.6 19.3h-5v16.2h5zM13.1 12a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8zM37.5 26.6c0-4.7-2.5-6.9-5.9-6.9-2.7 0-3.9 1.5-4.6 2.6v-2.2h-5v16.2h5v-9c0-.5 0-1 .2-1.3.4-1 1.3-1.9 2.7-1.9 1.9 0 2.6 1.4 2.6 3.5v8.7h5z"
      />
    </svg>
  ),

  github: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="currentColor"
        d="M24 3.5A20.5 20.5 0 0 0 17.5 43.5c1 .2 1.4-.4 1.4-1v-3.7c-5.7 1.2-6.9-2.7-6.9-2.7-.9-2.4-2.3-3-2.3-3-1.9-1.3.1-1.2.1-1.2 2.1.1 3.2 2.1 3.2 2.1 1.8 3.1 4.8 2.2 6 1.7.2-1.3.7-2.2 1.3-2.7-4.6-.5-9.4-2.3-9.4-10.2 0-2.3.8-4.1 2.1-5.6-.2-.5-.9-2.6.2-5.4 0 0 1.7-.6 5.6 2.1a19.4 19.4 0 0 1 10.2 0c3.9-2.7 5.6-2.1 5.6-2.1 1.1 2.8.4 4.9.2 5.4a8 8 0 0 1 2.1 5.6c0 7.9-4.8 9.7-9.4 10.2.7.6 1.4 1.9 1.4 3.8v5.6c0 .6.4 1.2 1.4 1A20.5 20.5 0 0 0 24 3.5z"
      />
    </svg>
  ),

  apple: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="currentColor"
        d="M33.7 25.4c0-4.4 3.6-6.5 3.8-6.6-2.1-3-5.3-3.5-6.4-3.5-2.7-.3-5.3 1.6-6.7 1.6-1.4 0-3.5-1.6-5.8-1.5-3 .04-5.7 1.7-7.2 4.4-3.1 5.4-.8 13.3 2.2 17.7 1.5 2.1 3.2 4.5 5.5 4.4 2.2-.1 3-1.4 5.7-1.4s3.4 1.4 5.8 1.4c2.4 0 3.9-2.1 5.3-4.3 1.7-2.4 2.4-4.8 2.4-4.9-.1-.05-4.6-1.8-4.6-7.3zM29.3 12.2c1.2-1.5 2-3.5 1.8-5.5-1.7.07-3.9 1.2-5.2 2.6-1.1 1.3-2.1 3.3-1.8 5.3 1.9.1 3.9-1 5.2-2.4z"
      />
    </svg>
  ),

  discord: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="11" fill="#5865F2" />
      <path
        fill="#fff"
        d="M32.6 15.4a22 22 0 0 0-5.4-1.7l-.3.7c-1.9-.3-3.8-.3-5.7 0l-.3-.7c-1.9.3-3.7.9-5.4 1.7-3.4 5.1-4.3 10-3.9 14.9a22 22 0 0 0 6.7 3.4l1.3-2.2c-.7-.3-1.4-.6-2.1-1l.5-.4c4 1.9 8.7 1.9 12.7 0l.5.4c-.7.4-1.4.7-2.1 1l1.3 2.2a22 22 0 0 0 6.7-3.4c.5-5.7-.9-10.6-3.9-14.9zM19.5 27.4c-1.3 0-2.4-1.2-2.4-2.7s1-2.7 2.4-2.7c1.3 0 2.4 1.2 2.4 2.7s-1.1 2.7-2.4 2.7zm9 0c-1.3 0-2.4-1.2-2.4-2.7s1-2.7 2.4-2.7c1.3 0 2.4 1.2 2.4 2.7s-1.1 2.7-2.4 2.7z"
      />
    </svg>
  ),

  x: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="11" fill="#0F1419" />
      <path
        fill="#fff"
        d="M27.6 21.6 37 11h-2.2l-8.2 9.2L20.1 11H12l9.9 14.1L12 36.2h2.2l8.6-9.7 6.9 9.7H38zm-3 3.4-1-1.4-8-11.1h3.4l6.4 9 1 1.4 8.3 11.7h-3.4z"
      />
    </svg>
  ),

  vercel: (size) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="currentColor" d="M24 7 43 40H5z" />
    </svg>
  ),

}

/**
 * Each brand's actual colour, so the monogram is still recognisably theirs.
 * Taken from published brand guidelines rather than eyedropped.
 */
const TINTS: Record<string, string> = {
  slack: '#4A154B',
  notion: '#191919',
  linear: '#5E6AD2',
  todoist: '#E44332',
  telegram: '#229ED9',
  stripe: '#635BFF',
  asana: '#F06A6A',
  jira: '#0052CC',
  airtable: '#FCB400',
  sentry: '#362D59',
  hubspot: '#FF7A59',
  calendly: '#006BFF',
  brave: '#FB542B',
  anthropic: '#D97757',
  openai: '#0F0F0F',
  deepseek: '#4D6BFE',
  groq: '#F55036',
  openrouter: '#1F2937',
  ollama: '#0F0F0F',
  fish: '#111827'
}

/** Two letters where one is ambiguous — OpenAI and OpenRouter, X and Xero. */
const LETTERS: Record<string, string> = {
  openai: 'AI',
  openrouter: 'OR',
  ollama: 'OL'
}

export const BrandMark = ({
  id,
  name,
  size = 22
}: {
  id: string
  name?: string
  size?: number
}): ReactNode => {
  const drawn = MARKS[id]
  if (drawn) return drawn(size)

  const letters =
    LETTERS[id] ?? ((name ?? id).replace(/[^a-z]/gi, '').charAt(0).toUpperCase() || '?')
  const tint = TINTS[id] ?? '#3F3F46'

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="44" height="44" x="2" y="2" rx="11" fill={tint} />
      <text
        x="24"
        y="25.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={letters.length > 1 ? 18 : 23}
        fontWeight="600"
        letterSpacing="-0.5"
        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        fill="#fff"
      >
        {letters}
      </text>
    </svg>
  )
}

export const hasBrandMark = (id: string): boolean => id in MARKS
