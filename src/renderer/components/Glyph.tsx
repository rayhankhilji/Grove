import type { ReactNode } from 'react'

/**
 * Grove's own icon set.
 *
 * Drawn rather than imported, because the parts of the app that carry meaning —
 * the brain, the boardroom, the attention ledger — have no honest equivalent in
 * a general-purpose icon library, and reaching for the nearest generic shape is
 * what makes an interface look assembled instead of designed.
 *
 * One system throughout: a 24-unit grid, 1.5 stroke, round caps and joins, and
 * a single accent element per mark that moves when the row is hovered or
 * current. All motion lives in CSS against the `data-part` attributes below, so
 * it can be switched off wholesale for reduced motion.
 */

const P = ({ d, part }: { d: string; part?: string }): ReactNode => (
  <path d={d} data-part={part} />
)

const C = ({ cx, cy, r, part, filled }: { cx: number; cy: number; r: number; part?: string; filled?: boolean }): ReactNode => (
  <circle cx={cx} cy={cy} r={r} data-part={part} {...(filled ? { fill: 'currentColor', stroke: 'none' } : {})} />
)

/**
 * The automations track, exported so the stylesheet's motion path is literally
 * the same curve the icon draws. Keeping one copy is the only way the token
 * and the line cannot drift apart.
 */
export const TRACK = 'M4 6.7h5.2a3 3 0 0 1 3 3v4.6a3 3 0 0 0 3 3H20'

/**
 * Each mark is a fragment; stroke, fill and sizing come from the wrapper so
 * every glyph is guaranteed to sit on the same optical weight.
 */
const MARKS: Record<string, ReactNode> = {
  /* Sunrise over a horizon — the day ahead, not a generic sun. */
  today: (
    <>
      <P d="M3 18h18" />
      <P d="M7.5 18a4.5 4.5 0 0 1 9 0" part="rise" />
      <P d="M12 5.5v2" part="ray" />
      <P d="M5.6 8.1l1.4 1.4" part="ray" />
      <P d="M18.4 8.1l-1.4 1.4" part="ray" />
    </>
  ),

  /* Two planes of a conversation, slightly out of register. */
  chat: (
    <>
      <P d="M4 5.5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8l-4 3z" part="near" />
      <P d="M9.5 9.5H20a1 1 0 0 1 1 1v4" part="far" />
    </>
  ),

  /* A round table with four seats, seen from above. Six read as noise at 16px;
     four still say "a meeting" and survive the size. */
  boardroom: (
    <>
      <C cx={12} cy={12} r={4} />
      <g data-part="seats">
        <C cx={12} cy={4.2} r={1.7} filled />
        <C cx={19.8} cy={12} r={1.7} filled />
        <C cx={12} cy={19.8} r={1.7} filled />
        <C cx={4.2} cy={12} r={1.7} filled />
      </g>
    </>
  ),

  /* A standing team: one lead, two reporting. The bracket that joined them
     was a third stroke competing with the nodes, so the nodes carry it now. */
  agents: (
    <>
      <C cx={12} cy={6} r={2.8} part="lead" />
      <P d="M12 8.8v2.4" />
      <P d="M6.8 15.2v-1.2a2 2 0 0 1 2-2h6.4a2 2 0 0 1 2 2v1.2" />
      <C cx={6.8} cy={18} r={2.8} part="node-a" />
      <C cx={17.2} cy={18} r={2.8} part="node-b" />
    </>
  ),

  /* A track with a token that actually travels it. The token rides the same
     path the stroke draws, via CSS motion path, so the two can never drift
     out of register the way two hand-tuned animations would. */
  automations: (
    <>
      <P d={TRACK} />
      <P d="M17.3 14.6 20 17.3l-2.7 2.7" part="tip" />
      <C cx={4} cy={6.7} r={2} part="origin" />
      <circle cx={0} cy={0} r={1.9} data-part="token" fill="currentColor" />
    </>
  ),

  /* Two links closing on each other. */
  connections: (
    <>
      <P d="M10.5 13.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1" part="link-a" />
      <P d="M13.5 10.5a3.5 3.5 0 0 0-5 0L6 13a3.5 3.5 0 0 0 5 5l1-1" part="link-b" />
    </>
  ),

  /* An actual brain: two hemispheres with a pinched waist and a longitudinal
     fissure down the middle. The gyri are a separate part that fades up on
     hover, so the mark stays clean at 16px and only shows its detail when
     something is pointing at it. */
  brain: (
    <>
      <P d="M12 4.4c-1.3 0-2.4.6-3 1.6-2.3.2-4 1.9-4 4 0 .8.2 1.6.7 2.2-.5.6-.7 1.3-.7 2.1 0 2.3 2 4.1 4.4 4.1h5.2c2.4 0 4.4-1.8 4.4-4.1 0-.8-.2-1.5-.7-2.1.5-.6.7-1.4.7-2.2 0-2.1-1.7-3.8-4-4-.6-1-1.7-1.6-3-1.6z" />
      <P d="M12 4.6v13.6" part="fissure" />
      <g data-part="gyri">
        <P d="M8.6 8.8c1.4 0 2.3 1 2.3 2.2" />
        <P d="M15.4 8.8c-1.4 0-2.3 1-2.3 2.2" />
        <P d="M9 14.7c1.1 0 1.8.7 1.8 1.7" />
        <P d="M15 14.7c-1.1 0-1.8.7-1.8 1.7" />
      </g>
    </>
  ),

  /* An hour swept out of a dial — where the time actually went. */
  attention: (
    <>
      <P d="M12 3.5a8.5 8.5 0 1 1-8.5 8.5" />
      <P d="M3.5 12A8.5 8.5 0 0 1 12 3.5V12z" part="sweep" />
      <P d="M12 12l4 2.5" part="hand" />
    </>
  ),

  /* A target with the shot already in flight. */
  objectives: (
    <>
      <C cx={12} cy={12} r={8.5} />
      <C cx={12} cy={12} r={4.5} part="inner" />
      <C cx={12} cy={12} r={1.4} part="bull" filled />
      <P d="M12 12 20.5 3.5M17.5 3.5h3v3" part="arrow" />
    </>
  ),

  /* A path that forks — the moment a decision exists. */
  decisions: (
    <>
      <P d="M12 21v-5" />
      <P d="M12 16c0-3 -1.5-4 -4-5.5" part="branch-a" />
      <P d="M12 16c0-3 1.5-4 4-5.5" part="branch-b" />
      <C cx={7.5} cy={8.5} r={2.2} part="end-a" />
      <C cx={16.5} cy={8.5} r={2.2} part="end-b" />
    </>
  ),

  /* Current arriving — the models that power everything else. */
  providers: (
    <>
      <P d="M12 2.5 4.5 7v10L12 21.5 19.5 17V7z" />
      <P d="M13 7.5 9 12.5h3.4L11 16.5l4-5h-3.4z" part="bolt" />
    </>
  ),

  /* Three settings, one out of alignment until you touch it. */
  settings: (
    <>
      <P d="M4 7h16M4 12h16M4 17h16" />
      <C cx={9} cy={7} r={2.2} part="knob-a" />
      <C cx={15.5} cy={12} r={2.2} part="knob-b" />
      <C cx={7.5} cy={17} r={2.2} part="knob-c" />
    </>
  ),

  /* A page with its lines — anything written for an audience. */
  doc: (
    <>
      <P d="M6 3.5h8l4 4v13H6z" />
      <P d="M14 3.5v4h4" />
      <P d="M9 12h6M9 15.5h4" part="lines" />
    </>
  ),

  /* An envelope, drawn as a fold rather than a rectangle with a V in it. */
  mail: (
    <>
      <P d="M3.5 6.5h17v11h-17z" />
      <P d="M3.5 7 12 13l8.5-6" part="flap" />
    </>
  ),

  /* A month, with today marked. */
  calendar: (
    <>
      <P d="M4 6.5h16v14H4z" />
      <P d="M4 10.5h16" />
      <P d="M8 3.5v4M16 3.5v4" part="pins" />
      <C cx={12} cy={15} r={1.6} part="dot" filled />
    </>
  ),

  /* Work passing from one hand to another. */
  handoff: (
    <>
      <C cx={5.5} cy={12} r={2.5} />
      <C cx={18.5} cy={12} r={2.5} />
      <P d="M8.5 12h7" part="line" />
      <P d="M13.5 9.5 16 12l-2.5 2.5" part="tip" />
    </>
  ),

  /* Stored context, stacked. */
  memory: (
    <>
      <P d="M4 7.5c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z" />
      <P d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" part="layer" />
      <P d="M4 7.5v9c0 1.7 3.6 3 8 3s8-1.3 8-3v-9" />
    </>
  )
}

export type GlyphName = keyof typeof MARKS

export const hasGlyph = (name: string): name is GlyphName => name in MARKS

export const Glyph = ({
  name,
  size = 18,
  strokeWidth = 1.5
}: {
  name: GlyphName
  size?: number
  strokeWidth?: number
}): ReactNode => (
  <svg
    className="glyph"
    data-glyph={name}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {MARKS[name]}
  </svg>
)
