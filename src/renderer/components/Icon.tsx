import type { ReactNode } from 'react'

/**
 * Grove's icon set — drawn rather than assembled.
 *
 * Everything sits on a 24×24 grid at a 1.15 stroke with round caps and joins,
 * and leans on open curves instead of closed geometric shapes, so the set reads
 * as pen work next to the serif rather than as a UI kit.
 */
const PATHS: Record<string, ReactNode> = {
  /* ── Navigation ──────────────────────────────────────────────────────── */
  // A sun clearing the horizon.
  today: (
    <>
      <path d="M3.4 17.4h17.2" />
      <path d="M7.6 17.4a4.4 4.4 0 0 1 8.8 0" />
      <path d="M12 4.1v2.4" />
      <path d="M5.6 7l1.7 1.7M18.4 7l-1.7 1.7" />
      <path d="M3.9 13.2h1.7M18.4 13.2h1.7" />
    </>
  ),
  // Two speech shapes leaning into each other.
  chat: (
    <>
      <path d="M4 15.6c-1-1.2-1.5-2.6-1.5-4.1C2.5 7.6 6 4.6 10.3 4.6s7.8 3 7.8 6.9c0 3.8-3.5 6.9-7.8 6.9a9.4 9.4 0 0 1-2.6-.4L4 19.5z" />
      <path d="M15.8 18.6c1.9-.3 3.6-1.2 4.6-2.5" />
    </>
  ),
  // A sapling — a working agent in a grove.
  agents: (
    <>
      <path d="M12 20.4V9.2" />
      <path d="M12 13.6c-2.9 0-4.6-1.7-4.9-4.6 2.9-.3 4.6 1.4 4.9 4.6z" />
      <path d="M12 11.4c2.6 0 4.2-1.6 4.5-4.2-2.6-.3-4.2 1.3-4.5 4.2z" />
      <path d="M9 20.4h6" />
    </>
  ),
  // Branching growth.
  workflows: (
    <>
      <path d="M12 20.5V6.3" />
      <path d="M12 12.6 7.2 8.8" />
      <path d="M12 15.4l4.4-3.5" />
      <circle cx="12" cy="4.6" r="1.7" />
      <circle cx="5.9" cy="7.8" r="1.7" />
      <circle cx="17.7" cy="10.8" r="1.7" />
    </>
  ),
  // Roots reaching out and joining.
  connections: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 9.5C12 6.7 13.9 4.6 17 4.2" />
      <path d="M9.7 10.9C7.4 9.5 6.2 7.4 6.4 4.6" />
      <path d="M10.9 14.2c-1.7 2-2 4.3-1 6.9" />
      <path d="M14.4 13.5c2.3.5 3.8 1.9 4.6 4.2" />
    </>
  ),
  // A ring of growth, struck through the centre.
  objectives: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  // A path forking, one branch chosen.
  decisions: (
    <>
      <path d="M12 20.6v-6.9" />
      <path d="M12 13.7 6.3 8.4" />
      <path d="M12 13.7l5.7-5.3" />
      <circle cx="5.2" cy="6.6" r="1.7" />
      <circle cx="18.8" cy="6.6" r="1.7" />
    </>
  ),
  // Sliders, drawn loose.
  settings: (
    <>
      <path d="M3.8 8.2h16.4M3.8 15.8h16.4" />
      <circle cx="9.4" cy="8.2" r="2.1" />
      <circle cx="15.2" cy="15.8" r="2.1" />
    </>
  ),
  // A pressed leaf — the collected context.
  brain: (
    <>
      <path d="M5.4 18.8c-1.8-5 .9-11 8-12.6 2.7-.6 4.6-1 5.6-1.6.5 1.3.8 3.2.4 6-1 6.9-6.7 10.3-11.6 9.2" />
      <path d="M6.2 19.4C8.5 14.6 11.9 11 16.4 8.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.3V12l3.2 2.2" />
    </>
  ),
  bolt: <path d="M13.3 3.4 6.6 13.1h4.8l-.5 7.2 6.7-9.7h-4.8z" strokeLinejoin="round" />,

  /* ── Actions ─────────────────────────────────────────────────────────── */
  send: (
    <>
      <path d="M12 19.2V5.4" />
      <path d="M6.5 10.8 12 5.1l5.5 5.7" />
    </>
  ),
  plus: <path d="M12 5.4v13.2M5.4 12h13.2" />,
  close: <path d="M6.6 6.6l10.8 10.8M17.4 6.6 6.6 17.4" />,
  check: <path d="M5.4 12.5l3.9 3.9 8.9-9.3" />,
  copy: (
    <>
      <rect x="8.6" y="8.6" width="10.8" height="10.8" rx="2.6" />
      <path d="M15.4 8.6V7a2.6 2.6 0 0 0-2.6-2.6H7a2.6 2.6 0 0 0-2.6 2.6v5.8A2.6 2.6 0 0 0 7 15.4h1.6" />
    </>
  ),
  retry: (
    <>
      <path d="M19.4 12a7.4 7.4 0 1 1-2.6-5.6" />
      <path d="M19.6 4.2v3.9h-3.9" />
    </>
  ),
  play: <path d="M8.4 5.6 18.4 12 8.4 18.4z" strokeLinejoin="round" />,
  pause: <path d="M9.2 6.2v11.6M14.8 6.2v11.6" />,
  stop: <rect x="7.2" y="7.2" width="9.6" height="9.6" rx="2" />,
  trash: (
    <>
      <path d="M5 7.4h14" />
      <path d="M9.8 7.4V6a1.6 1.6 0 0 1 1.6-1.6h1.2A1.6 1.6 0 0 1 14.2 6v1.4" />
      <path d="M6.8 7.4l.8 10.4a2 2 0 0 0 2 1.8h4.8a2 2 0 0 0 2-1.8l.8-10.4" />
    </>
  ),
  chevron: <path d="M9.8 6.4 15.4 12l-5.6 5.6" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6" />
      <path d="M15.3 15.3 19.8 19.8" />
    </>
  ),
  // A four-point star, hand-drawn.
  sparkle: (
    <>
      <path
        d="M12 3.6c.9 4.4 1.9 5.5 6.3 6.4-4.4.9-5.4 1.9-6.3 6.3-.9-4.4-1.9-5.4-6.3-6.3 4.4-.9 5.4-2 6.3-6.4z"
        strokeLinejoin="round"
      />
      <path d="M17.6 16c.4 1.9.9 2.4 2.8 2.8-1.9.4-2.4.9-2.8 2.8-.4-1.9-.9-2.4-2.8-2.8 1.9-.4 2.4-.9 2.8-2.8z" strokeLinejoin="round" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.8" width="16" height="14.2" rx="2.6" />
      <path d="M4 10.2h16M8.6 3.8v3.2M15.4 3.8v3.2" />
    </>
  ),
  mail: (
    <>
      <rect x="3.2" y="6" width="17.6" height="12" rx="2.6" />
      <path d="M4.2 7.9 10.7 12.7a2.2 2.2 0 0 0 2.6 0l6.5-4.8" />
    </>
  ),
  // A hand-off between two tracks.
  handoff: (
    <>
      <path d="M4 12h7.4a3.4 3.4 0 0 0 3.4-3.4V6.8" />
      <path d="M12.4 4.4 14.9 6.8l-2.5 2.4" />
      <path d="M20 17h-7.4a3.4 3.4 0 0 1-3.4-3.4v-1.2" />
      <path d="M17.5 14.6 20 17l-2.5 2.4" />
    </>
  ),
  tool: (
    <path
      d="M14.9 4.6a4.7 4.7 0 0 0-5.6 6.1l-5.2 5.2a1.9 1.9 0 0 0 2.7 2.7l5.2-5.2a4.7 4.7 0 0 0 6.1-5.6l-2.6 2.6-2.9-.5-.5-2.9z"
      strokeLinejoin="round"
    />
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.6v5M12 16.1v.1" />
    </>
  ),
  external: (
    <>
      <path d="M13.6 5h5.4v5.4" />
      <path d="M19 5 11.4 12.6" />
      <path d="M17 14v3.9a2.1 2.1 0 0 1-2.1 2.1H6.6a2.1 2.1 0 0 1-2.1-2.1V9.6a2.1 2.1 0 0 1 2.1-2.1h3.9" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.4" r="3.6" />
      <path d="M5.2 19.6a6.8 6.8 0 0 1 13.6 0" />
    </>
  ),
  doc: (
    <>
      <path d="M6 5.2A2.2 2.2 0 0 1 8.2 3h5.2l5 5v10.8a2.2 2.2 0 0 1-2.2 2.2H8.2a2.2 2.2 0 0 1-2.2-2.2z" />
      <path d="M13.2 3.2v5h4.8" />
    </>
  ),
  memory: (
    <>
      <path d="M12 4.8a3.6 3.6 0 0 0-3.6 3.6v6.9a3.6 3.6 0 0 0 7.2 0V8.4A3.6 3.6 0 0 0 12 4.8z" />
      <path d="M8.4 10.2H5.7M15.6 10.2h2.7M8.4 13.6H5.7M15.6 13.6h2.7" />
    </>
  ),

  /* ── Provider marks (monochrome fallbacks) ───────────────────────────── */
  google: <circle cx="12" cy="12" r="8" />,
  microsoft: (
    <>
      <rect x="4.4" y="4.4" width="6.6" height="6.6" />
      <rect x="13" y="4.4" width="6.6" height="6.6" />
      <rect x="4.4" y="13" width="6.6" height="6.6" />
      <rect x="13" y="13" width="6.6" height="6.6" />
    </>
  ),
  slack: (
    <>
      <rect x="10.4" y="3.4" width="3.2" height="8.8" rx="1.6" />
      <rect x="10.4" y="11.8" width="3.2" height="8.8" rx="1.6" />
      <rect x="3.4" y="10.4" width="8.8" height="3.2" rx="1.6" />
      <rect x="11.8" y="10.4" width="8.8" height="3.2" rx="1.6" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3" />
      <path d="M7.9 10.5v5.6M7.9 7.9v.1" />
      <path d="M11.8 16.1v-5.6M11.8 12.9a2.4 2.4 0 0 1 4.7 0v3.2" />
    </>
  ),
  notion: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2.8" />
      <path d="M8.4 16.1V8.3l7.2 7.4V7.9" />
    </>
  ),
  linear: (
    <>
      <path d="M4 14 10 20" />
      <path d="M3.8 9.8 14.2 20.2" />
      <path d="M4.6 6.2 17.8 19.4" />
      <path d="M7.4 4.3 19.7 16.6" />
    </>
  ),
  github: (
    <>
      <path d="M15.1 20v-2.9a2.5 2.5 0 0 0-.7-1.9c2.4-.3 4.8-1.1 4.8-5.2a4 4 0 0 0-1.1-2.8 3.7 3.7 0 0 0-.1-2.8s-1-.2-3 1.1a10.2 10.2 0 0 0-5.3 0C7.7 4.2 6.7 4.4 6.7 4.4a3.7 3.7 0 0 0-.1 2.8 4 4 0 0 0-1.1 2.8c0 4.1 2.4 4.9 4.8 5.2a2.5 2.5 0 0 0-.7 1.9V20" />
      <path d="M9.6 18.2c-2.9 1-2.9-1.7-4.1-1.9" />
    </>
  ),
  todoist: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.6" />
      <path d="M7.9 9.1l3.6 2.2M7.9 13.4l3.6 2.2M16.1 7.7l-4.6 2.6M16.1 12l-4.6 2.6" />
    </>
  ),
  apple: <circle cx="12" cy="12" r="8" />
}

export type IconName = keyof typeof PATHS

export const Icon = ({
  name,
  size = 17,
  strokeWidth = 1.15
}: {
  name: IconName
  size?: number
  strokeWidth?: number
}): ReactNode => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {PATHS[name]}
  </svg>
)
