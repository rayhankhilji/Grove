import {
  AlertCircle,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Pause,
  Play,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  Square,
  Trash2,
  User,
  Wrench,
  X,
  Zap,
  type LucideIcon
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Glyph, hasGlyph } from './Glyph'

/**
 * Grove's icon vocabulary.
 *
 * Anything that names a part of the product — brain, boardroom, attention —
 * is drawn by hand in `Glyph` and animates on hover. What is left here is the
 * universal controls, where a stock mark is the right answer precisely because
 * nobody should have to learn it.
 *
 * Call sites use domain names rather than icon names either way, so swapping a
 * single mark stays a one-line change instead of a find-and-replace.
 */
const CONTROLS = {
  send: ArrowUp,
  plus: Plus,
  close: X,
  check: Check,
  copy: Copy,
  retry: RotateCw,
  play: Play,
  pause: Pause,
  stop: Square,
  trash: Trash2,
  chevron: ChevronRight,
  search: Search,
  sparkle: Sparkles,
  bolt: Zap,
  tool: Wrench,
  alert: AlertCircle,
  external: ExternalLink,
  user: User
} satisfies Record<string, LucideIcon>

/** Names Grove draws itself, listed so the exported type stays honest. */
type DrawnName =
  | 'today'
  | 'chat'
  | 'boardroom'
  | 'agents'
  | 'automations'
  | 'workflows'
  | 'connections'
  | 'brain'
  | 'attention'
  | 'clock'
  | 'objectives'
  | 'decisions'
  | 'providers'
  | 'settings'
  | 'doc'
  | 'mail'
  | 'calendar'
  | 'handoff'
  | 'memory'

/** Older call sites use a couple of earlier names; map rather than churn them. */
const ALIASES: Record<string, string> = {
  workflows: 'automations',
  clock: 'attention'
}

export type IconName = DrawnName | keyof typeof CONTROLS

export const Icon = ({
  name,
  size = 16,
  strokeWidth = 1.6
}: {
  name: IconName
  size?: number
  strokeWidth?: number
}): ReactNode => {
  const drawn = ALIASES[name] ?? name
  if (hasGlyph(drawn)) return <Glyph name={drawn} size={size} strokeWidth={strokeWidth} />

  const Control = CONTROLS[name as keyof typeof CONTROLS]
  if (!Control) return null
  return <Control size={size} strokeWidth={strokeWidth} absoluteStrokeWidth aria-hidden />
}
