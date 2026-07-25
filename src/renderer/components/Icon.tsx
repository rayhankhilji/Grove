import type { ReactNode } from 'react'

/**
 * Stobs' icon set. Every glyph is drawn on the same 20×20 grid with a 1.6
 * stroke and round joins, so the whole UI reads as one hand. Provider marks
 * are simplified geometry rather than official logos.
 */
const PATHS: Record<string, ReactNode> = {
  /* ── Navigation ──────────────────────────────────────────────────────── */
  // A horizon with a rising arc — the start of the day.
  today: (
    <>
      <path d="M3 14.5h14" />
      <path d="M6.2 14.5a3.8 3.8 0 0 1 7.6 0" />
      <path d="M10 3.5v2M4.6 5.9l1.3 1.3M15.4 5.9l-1.3 1.3" />
    </>
  ),
  // Two minds overlapping — a council, not a chat bubble.
  council: (
    <>
      <circle cx="7.6" cy="10" r="4.6" />
      <circle cx="12.4" cy="10" r="4.6" />
    </>
  ),
  // A processing core with legs.
  agents: (
    <>
      <rect x="6" y="6" width="8" height="8" rx="2" />
      <path d="M8.4 3.4v2.6M11.6 3.4v2.6M8.4 14v2.6M11.6 14v2.6" />
      <path d="M3.4 8.4H6M3.4 11.6H6M14 8.4h2.6M14 11.6h2.6" />
    </>
  ),
  // Nodes joined into a flow.
  workflows: (
    <>
      <circle cx="5" cy="5.4" r="2.2" />
      <circle cx="15" cy="10" r="2.2" />
      <circle cx="5" cy="14.6" r="2.2" />
      <path d="M7 6.4c3.4 1 4.2 2.2 5.9 3M7 13.6c3.4-1 4.2-2.2 5.9-3" />
    </>
  ),
  // A hub with spokes reaching outward.
  connections: (
    <>
      <circle cx="10" cy="10" r="2.4" />
      <circle cx="16.2" cy="5.4" r="1.7" />
      <circle cx="4" cy="7.6" r="1.7" />
      <circle cx="7.4" cy="16" r="1.7" />
      <path d="M11.9 8.6l2.9-2.1M7.7 9.2L5.6 8.4M9.2 12.2l-1 2.2" />
    </>
  ),
  // Concentric rings with a struck centre.
  objectives: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="3.4" />
      <circle cx="10" cy="10" r="0.5" fill="currentColor" stroke="none" />
    </>
  ),
  // A path that forks and commits to one branch.
  decisions: (
    <>
      <path d="M10 17V11" />
      <path d="M10 11 5 6.6" />
      <path d="M10 11l5-4.4" />
      <circle cx="4.2" cy="5.4" r="1.6" />
      <circle cx="15.8" cy="5.4" r="1.6" />
    </>
  ),
  // Sliders read as settings without the tired gear.
  settings: (
    <>
      <path d="M3.2 6.4h13.6M3.2 13.6h13.6" />
      <circle cx="8" cy="6.4" r="2.1" />
      <circle cx="13" cy="13.6" r="2.1" />
    </>
  ),

  /* ── Actions ─────────────────────────────────────────────────────────── */
  send: (
    <>
      <path d="M10 16V4.6" />
      <path d="M5.4 9.2 10 4.4l4.6 4.8" />
    </>
  ),
  plus: <path d="M10 4.6v10.8M4.6 10h10.8" />,
  close: <path d="M5.6 5.6l8.8 8.8M14.4 5.6l-8.8 8.8" />,
  check: <path d="M4.6 10.6l3.4 3.3 7.4-7.8" />,
  copy: (
    <>
      <rect x="7.2" y="7.2" width="9" height="9" rx="2.2" />
      <path d="M12.8 7.2V5.9a2.2 2.2 0 0 0-2.2-2.2H5.9a2.2 2.2 0 0 0-2.2 2.2v4.7a2.2 2.2 0 0 0 2.2 2.2h1.3" />
    </>
  ),
  retry: (
    <>
      <path d="M16 10a6 6 0 1 1-2.1-4.6" />
      <path d="M16.3 3.6v3.7h-3.7" />
    </>
  ),
  play: <path d="M7 4.9 15.4 10 7 15.1z" strokeLinejoin="round" />,
  stop: <rect x="6.2" y="6.2" width="7.6" height="7.6" rx="1.8" />,
  pause: <path d="M7.8 5.4v9.2M12.2 5.4v9.2" />,
  trash: (
    <>
      <path d="M4.4 6.2h11.2" />
      <path d="M8.2 6.2V4.9a1.3 1.3 0 0 1 1.3-1.3h1a1.3 1.3 0 0 1 1.3 1.3v1.3" />
      <path d="M5.9 6.2l.7 8.6a1.6 1.6 0 0 0 1.6 1.5h3.6a1.6 1.6 0 0 0 1.6-1.5l.7-8.6" />
    </>
  ),
  chevron: <path d="M8.2 5.4 12.8 10l-4.6 4.6" />,
  chevronDown: <path d="M5.4 8.2 10 12.8l4.6-4.6" />,
  search: (
    <>
      <circle cx="9" cy="9" r="5" />
      <path d="M12.8 12.8 16.4 16.4" />
    </>
  ),
  // A four-point star for model reasoning.
  sparkle: (
    <>
      <path d="M10 3.4c.7 3.6 1.5 4.5 5.2 5.2-3.7.7-4.5 1.6-5.2 5.2-.7-3.6-1.5-4.5-5.2-5.2 3.7-.7 4.5-1.6 5.2-5.2z" strokeLinejoin="round" />
      <path d="M15.2 13.2c.3 1.6.7 2 2.3 2.3-1.6.3-2 .7-2.3 2.3-.3-1.6-.7-2-2.3-2.3 1.6-.3 2-.7 2.3-2.3z" strokeLinejoin="round" />
    </>
  ),
  clock: (
    <>
      <circle cx="10" cy="10" r="6.6" />
      <path d="M10 6.2V10l2.6 1.8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.6" y="4.8" width="12.8" height="11.6" rx="2.2" />
      <path d="M3.6 8.4h12.8M7.2 3.4v2.6M12.8 3.4v2.6" />
    </>
  ),
  mail: (
    <>
      <rect x="3.2" y="5" width="13.6" height="10" rx="2.2" />
      <path d="M4 6.6l5.1 3.8a1.5 1.5 0 0 0 1.8 0L16 6.6" />
    </>
  ),
  bolt: <path d="M11 3.2 5.4 11h4l-.4 5.8L14.6 9h-4z" strokeLinejoin="round" />,
  // A branch handing off to another track.
  handoff: (
    <>
      <path d="M3.6 10h6.2a3 3 0 0 0 3-3V5.6" />
      <path d="M10.4 3.4 12.8 5.6l-2.4 2.2" />
      <path d="M16.4 14h-6.2a3 3 0 0 1-3-3v-1" />
      <path d="M14 11.8 16.4 14 14 16.2" />
    </>
  ),
  tool: (
    <>
      <path d="M12.4 3.8a3.9 3.9 0 0 0-4.6 5.1l-4.3 4.3a1.6 1.6 0 0 0 2.3 2.3l4.3-4.3a3.9 3.9 0 0 0 5.1-4.6l-2.2 2.2-2.4-.4-.4-2.4z" strokeLinejoin="round" />
    </>
  ),
  alert: (
    <>
      <circle cx="10" cy="10" r="6.8" />
      <path d="M10 6.4v4.2M10 13.4v.1" />
    </>
  ),
  external: (
    <>
      <path d="M11 4.4h4.6V9" />
      <path d="M15.6 4.4 9.4 10.6" />
      <path d="M14 11.6v3.2a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8V8a1.8 1.8 0 0 1 1.8-1.8h3.2" />
    </>
  ),
  user: (
    <>
      <circle cx="10" cy="7.2" r="3" />
      <path d="M4.6 16.2a5.6 5.6 0 0 1 10.8 0" />
    </>
  ),
  memory: (
    <>
      <path d="M10 4.2a3 3 0 0 0-3 3v5.6a3 3 0 0 0 6 0V7.2a3 3 0 0 0-3-3z" />
      <path d="M7 8.6H4.8M13 8.6h2.2M7 11.4H4.8M13 11.4h2.2" />
    </>
  ),
  doc: (
    <>
      <path d="M5.2 4.4a1.8 1.8 0 0 1 1.8-1.8h4l4 4v9a1.8 1.8 0 0 1-1.8 1.8H7a1.8 1.8 0 0 1-1.8-1.8z" />
      <path d="M10.8 2.8v3.8h3.9" />
    </>
  ),

  /* ── Provider marks ──────────────────────────────────────────────────── */
  google: (
    <>
      <path d="M16.4 10.2c0-.5 0-1-.1-1.5H10v3h3.6a3.1 3.1 0 0 1-1.4 2v1.9h2.3a6.6 6.6 0 0 0 1.9-5.4z" />
      <path d="M10 17a6.5 6.5 0 0 0 4.5-1.6l-2.3-1.8a4 4 0 0 1-6-2.1H3.8v1.9A7 7 0 0 0 10 17z" />
      <path d="M6.2 11.5a4.1 4.1 0 0 1 0-2.6V7H3.8a7 7 0 0 0 0 6.3z" />
      <path d="M10 6a3.8 3.8 0 0 1 2.7 1l2-2A6.7 6.7 0 0 0 3.8 7l2.4 1.9A4 4 0 0 1 10 6z" />
    </>
  ),
  microsoft: (
    <>
      <rect x="3.6" y="3.6" width="6" height="6" />
      <rect x="10.4" y="3.6" width="6" height="6" />
      <rect x="3.6" y="10.4" width="6" height="6" />
      <rect x="10.4" y="10.4" width="6" height="6" />
    </>
  ),
  slack: (
    <>
      <rect x="8.6" y="2.8" width="2.8" height="7.4" rx="1.4" />
      <rect x="8.6" y="9.8" width="2.8" height="7.4" rx="1.4" />
      <rect x="2.8" y="8.6" width="7.4" height="2.8" rx="1.4" />
      <rect x="9.8" y="8.6" width="7.4" height="2.8" rx="1.4" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3.2" y="3.2" width="13.6" height="13.6" rx="2.6" />
      <path d="M6.6 8.8v4.6M6.6 6.6v.1" />
      <path d="M9.8 13.4V8.8M9.8 10.8a2 2 0 0 1 3.9 0v2.6" />
    </>
  ),
  notion: (
    <>
      <rect x="3.4" y="3.4" width="13.2" height="13.2" rx="2.4" />
      <path d="M7 13.4V6.9l6 6.1V6.6" />
    </>
  ),
  linear: (
    <>
      <path d="M3.4 11.6 8.4 16.6" />
      <path d="M3.2 8.2 11.8 16.8" />
      <path d="M3.8 5.2 14.8 16.2" />
      <path d="M6.2 3.6 16.4 13.8" />
    </>
  ),
  github: (
    <>
      <path d="M12.6 16.6v-2.4a2.1 2.1 0 0 0-.6-1.6c2-.2 4-.9 4-4.3a3.3 3.3 0 0 0-.9-2.3 3 3 0 0 0-.1-2.3s-.8-.2-2.5.9a8.5 8.5 0 0 0-4.4 0C6.4 3.5 5.6 3.7 5.6 3.7a3 3 0 0 0-.1 2.3 3.3 3.3 0 0 0-.9 2.3c0 3.4 2 4.1 4 4.3a2.1 2.1 0 0 0-.6 1.6v2.4" />
      <path d="M8 15.2c-2.4.8-2.4-1.4-3.4-1.6" />
    </>
  ),
  todoist: (
    <>
      <rect x="3.4" y="3.4" width="13.2" height="13.2" rx="3" />
      <path d="M6.6 7.6l3 1.8M6.6 11.2l3 1.8M13.4 6.4l-3.8 2.2M13.4 10l-3.8 2.2" />
    </>
  ),

  /* ── Brand ───────────────────────────────────────────────────────────── */
  // The Stobs mark: a steady core inside an open orbit.
  logo: (
    <>
      <path d="M16.2 6.4A7 7 0 1 0 17 10" />
      <circle cx="10" cy="10" r="2.6" fill="currentColor" stroke="none" />
    </>
  )
}

export type IconName = keyof typeof PATHS

export const Icon = ({
  name,
  size = 16,
  strokeWidth = 1.6
}: {
  name: IconName
  size?: number
  strokeWidth?: number
}): ReactNode => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    aria-hidden="true"
  >
    {PATHS[name]}
  </svg>
)
