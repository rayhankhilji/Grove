import type { ReactNode } from 'react'
import {
  siAirtable,
  siAnthropic,
  siApple,
  siAsana,
  siBrave,
  siCalendly,
  siDeepseek,
  siDiscord,
  siGithub,
  siGoogle,
  siHubspot,
  siJira,
  siLinear,
  siNotion,
  siOllama,
  siOpenrouter,
  siSentry,
  siStripe,
  siTelegram,
  siTodoist,
  siVercel,
  siX
} from 'simple-icons'

/**
 * Provider marks.
 *
 * Real geometry, from Simple Icons — every path here is the brand's own, at
 * their own hex. Hand-tracing logos was the wrong instinct: an approximation of
 * a mark people recognise reads worse than no mark at all.
 *
 * Five brands enforce their trademark by staying out of that set — Microsoft,
 * Slack, LinkedIn, OpenAI and Groq — so those are drawn here, and anything with
 * no mark at all falls back to a monogram rather than a wrong logo.
 */

interface SimpleIcon {
  title: string
  hex: string
  path: string
}

const OFFICIAL: Record<string, SimpleIcon> = {
  google: siGoogle,
  discord: siDiscord,
  telegram: siTelegram,
  notion: siNotion,
  linear: siLinear,
  asana: siAsana,
  jira: siJira,
  todoist: siTodoist,
  airtable: siAirtable,
  github: siGithub,
  vercel: siVercel,
  sentry: siSentry,
  stripe: siStripe,
  hubspot: siHubspot,
  calendly: siCalendly,
  x: siX,
  brave: siBrave,
  apple: siApple,
  anthropic: siAnthropic,
  deepseek: siDeepseek,
  openrouter: siOpenrouter,
  ollama: siOllama
}

/**
 * Marks that are pure black in the official set. Rendering those at full
 * strength makes a row of logos read as a row of blobs, so they take the
 * interface ink instead and let the coloured brands carry the accent.
 */
const INK = new Set(['notion', 'vercel', 'x', 'apple', 'anthropic', 'ollama', 'github'])

const official = (id: string, size: number): ReactNode => {
  const icon = OFFICIAL[id]!
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <title>{icon.title}</title>
      <path d={icon.path} fill={INK.has(id) ? 'currentColor' : `#${icon.hex}`} />
    </svg>
  )
}

/* ── The five that keep their marks out of the open set ──────────────────── */

const DRAWN: Record<string, (size: number) => ReactNode> = {
  microsoft: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  ),

  slack: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill="#36C5F0" d="M5.04 15.17a2.53 2.53 0 1 1-2.52-2.53h2.52zm1.27 0a2.53 2.53 0 0 1 5.05 0v6.31a2.53 2.53 0 0 1-5.05 0z" />
      <path fill="#2EB67D" d="M8.83 5.03a2.53 2.53 0 1 1 2.53-2.52v2.52zm0 1.29a2.53 2.53 0 0 1 0 5.05H2.52a2.53 2.53 0 0 1 0-5.05z" />
      <path fill="#ECB22E" d="M18.96 8.83a2.53 2.53 0 1 1 2.52 2.53h-2.52zm-1.27 0a2.53 2.53 0 0 1-5.05 0V2.52a2.53 2.53 0 0 1 5.05 0z" />
      <path fill="#E01E5A" d="M15.17 18.96a2.53 2.53 0 1 1-2.53 2.52v-2.52zm0-1.27a2.53 2.53 0 0 1 0-5.05h6.31a2.53 2.53 0 0 1 0 5.05z" />
    </svg>
  ),

  linkedin: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#0A66C2"
        d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"
      />
    </svg>
  ),

  openai: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M22.28 9.82a5.99 5.99 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6 6 0 0 0 4.98 4.18a5.99 5.99 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.52 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.75-7.07zm-9.02 12.6a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.79.79 0 0 0 .39-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.49 4.5zM3.6 18.3a4.47 4.47 0 0 1-.54-3.01l.14.09 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06L9.74 19.9a4.5 4.5 0 0 1-6.14-1.64zM2.34 7.9a4.49 4.49 0 0 1 2.35-1.97V11.6a.77.77 0 0 0 .38.67l5.82 3.36-2.02 1.17a.08.08 0 0 1-.07 0l-4.83-2.79A4.5 4.5 0 0 1 2.34 7.9zm16.6 3.86-5.83-3.4L15.13 7.2a.08.08 0 0 1 .07 0l4.83 2.79a4.49 4.49 0 0 1-.68 8.1v-5.66a.79.79 0 0 0-.4-.67zm2.01-3.02-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.42 9.24V6.9a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66zM8.32 12.86 6.3 11.7a.08.08 0 0 1-.04-.06V6.07a4.5 4.5 0 0 1 7.38-3.45l-.14.08L8.72 5.46a.79.79 0 0 0-.39.68zm1.1-2.37 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5z"
      />
    </svg>
  ),

  groq: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#F55036" />
      <path
        fill="#fff"
        d="M12 5.5a6.5 6.5 0 1 0 4.1 11.55l1.5 1.5 1.3-1.3-1.5-1.5A6.5 6.5 0 0 0 12 5.5zm0 2.2a4.3 4.3 0 1 1 0 8.6 4.3 4.3 0 0 1 0-8.6z"
      />
    </svg>
  ),

  fish: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M2 12c2.6-4.4 6.3-6.6 11-6.6 2.2 0 4.1.5 5.7 1.6L21.5 4v16l-2.8-3c-1.6 1.1-3.5 1.6-5.7 1.6-4.7 0-8.4-2.2-11-6.6zm12.6-1.7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"
      />
    </svg>
  )
}

/**
 * A provider's mark.
 *
 * Official path where one exists, hand-drawn for the five that withhold theirs,
 * and a monogram in the interface ink for anything else — a deliberate letter
 * beats a bad trace.
 */
export const BrandMark = ({
  id,
  name,
  size = 22
}: {
  id: string
  name?: string
  size?: number
}): ReactNode => {
  if (OFFICIAL[id]) return official(id, size)
  if (DRAWN[id]) return DRAWN[id]!(size)

  const letter = (name ?? id).replace(/[^a-z]/gi, '').charAt(0).toUpperCase() || '?'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect width="22" height="22" x="1" y="1" rx="6" fill="var(--fg)" />
      <text
        x="12"
        y="12.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="600"
        fontFamily="-apple-system, BlinkMacSystemFont, sans-serif"
        fill="var(--bg)"
      >
        {letter}
      </text>
    </svg>
  )
}

export const hasBrandMark = (id: string): boolean => id in OFFICIAL || id in DRAWN
