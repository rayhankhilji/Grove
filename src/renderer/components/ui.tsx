import { useEffect, useRef, useState, type ReactNode } from 'react'
import { render } from '../lib/markdown'
import { api } from '../lib/api'
import { Icon, type IconName } from './Icon'

export const Ring = ({ value, size = 34 }: { value: number; size?: number }): ReactNode => {
  const stroke = 3
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg className="ring" width={size} height={size} aria-hidden>
        <circle className="track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(100, value)) / 100)}
        />
      </svg>
      <span>{Math.round(value)}</span>
    </div>
  )
}

export const Empty = ({
  icon,
  title,
  children
}: {
  icon: IconName
  title: string
  children: ReactNode
}): ReactNode => (
  <div className="empty">
    <div className="halo">
      <Icon name={icon} size={20} />
    </div>
    <h3>{title}</h3>
    <p>{children}</p>
  </div>
)

/** Renders sanitised markdown and routes link clicks to the system browser. */
export const Prose = ({ markdown }: { markdown: string }): ReactNode => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const onClick = (event: MouseEvent): void => {
      const anchor = (event.target as HTMLElement).closest('a')
      if (!anchor) return
      event.preventDefault()
      void api.openExternal(anchor.getAttribute('href') ?? '')
    }
    node.addEventListener('click', onClick)
    return () => node.removeEventListener('click', onClick)
  }, [])

  return <div className="prose" ref={ref} dangerouslySetInnerHTML={{ __html: render(markdown) }} />
}

export const Field = ({
  label,
  hint,
  children
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}): ReactNode => (
  <div className="field">
    <label>{label}</label>
    {children}
    {hint ? <span className="hint">{hint}</span> : null}
  </div>
)

export const Switch = ({
  on,
  onChange,
  label
}: {
  on: boolean
  onChange: (next: boolean) => void
  label: string
}): ReactNode => (
  <button className="switch" data-on={on} onClick={() => onChange(!on)} aria-label={label} aria-pressed={on} />
)

/**
 * Text input that saves as you type, debounced. The previous build only
 * committed on blur, which read as "settings don't save".
 */
export const LiveInput = ({
  value,
  onCommit,
  placeholder,
  multiline,
  rows = 3
}: {
  value: string
  onCommit: (next: string) => void
  placeholder?: string
  multiline?: boolean
  rows?: number
}): ReactNode => {
  const [draft, setDraft] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)

  // Accept external updates only while the user is not mid-edit.
  useEffect(() => {
    if (!dirty.current) setDraft(value)
  }, [value])

  const change = (next: string): void => {
    dirty.current = true
    setDraft(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      dirty.current = false
      onCommit(next)
    }, 350)
  }

  const flush = (): void => {
    if (timer.current) clearTimeout(timer.current)
    dirty.current = false
    if (draft !== value) onCommit(draft)
  }

  return multiline ? (
    <textarea rows={rows} value={draft} placeholder={placeholder} onChange={(e) => change(e.target.value)} onBlur={flush} />
  ) : (
    <input type="text" value={draft} placeholder={placeholder} onChange={(e) => change(e.target.value)} onBlur={flush} />
  )
}

export const Sheet = ({
  title,
  onClose,
  children,
  actions
}: {
  title: string
  onClose: () => void
  children: ReactNode
  actions?: ReactNode
}): ReactNode => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="sheet" onMouseDown={(event) => event.stopPropagation()}>
        <div className="split">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={17} />
          </button>
        </div>
        {children}
        {actions ? <div className="sheet-actions">{actions}</div> : null}
      </div>
    </div>
  )
}

/** Anchored menu that closes on outside click or Escape. */
export const Popover = ({
  open,
  onClose,
  align = 'left',
  below,
  children
}: {
  open: boolean
  onClose: () => void
  align?: 'left' | 'right'
  below?: boolean
  children: ReactNode
}): ReactNode => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!ref.current?.parentElement?.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className={`pop${below ? ' down' : ''}${align === 'right' ? ' right' : ''}`} ref={ref}>
      {children}
    </div>
  )
}

export const Avatar = ({
  glyph,
  tint,
  size = 30
}: {
  glyph: string
  tint: string
  size?: number
}): ReactNode => (
  <div className="avatar" style={{ width: size, height: size, color: tint }}>
    <Icon name={glyph as IconName} size={Math.round(size * 0.72)} />
  </div>
)

export const relative = (iso: string): string => {
  const delta = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(delta / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
