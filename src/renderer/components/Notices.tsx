import { useState, type ReactNode } from 'react'
import type { Notice, NoticeKind } from '@shared/types'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Icon, type IconName } from './Icon'
import { relative } from './ui'

/**
 * The notification centre.
 *
 * Grove does most of its work while you are looking at something else. A macOS
 * banner announces that once and disappears; this is the record you can come
 * back to, and the only place in the chrome that ever asks for attention.
 */

const MARK: Record<NoticeKind, { icon: IconName; tone: string }> = {
  approval: { icon: 'alert', tone: 'warn' },
  run: { icon: 'check', tone: 'ok' },
  automation: { icon: 'automations', tone: '' },
  error: { icon: 'alert', tone: 'bad' },
  connection: { icon: 'connections', tone: '' }
}

const Bell = ({ ringing }: { ringing: boolean }): ReactNode => (
  <svg
    className="bell"
    data-ringing={ringing}
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5z" data-part="body" />
    <path d="M10.3 19a2 2 0 0 0 3.4 0" data-part="clapper" />
  </svg>
)

export const Notices = ({ onGo }: { onGo: (view: string) => void }): ReactNode => {
  const { state, apply } = useStore()
  const [open, setOpen] = useState(false)

  const notices: Notice[] = state.notices ?? []
  const unread = notices.filter((notice) => !notice.read).length

  const toggle = async (): Promise<void> => {
    const next = !open
    setOpen(next)
    // Opening the panel is the acknowledgement — a separate "mark all read"
    // button is a chore nobody wants.
    if (next && unread > 0) apply(await api.markNoticesRead())
  }

  return (
    <div className="pop-wrap">
      <button
        className="bell-btn"
        data-unread={unread > 0}
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        onClick={() => void toggle()}
      >
        <Bell ringing={unread > 0} />
        {unread > 0 ? <span className="pip" /> : null}
      </button>

      {open ? (
        <>
          <div className="pop-catch" onMouseDown={() => setOpen(false)} />
          <div className="notices">
            <div className="notices-head">
              <span className="grow">Notifications</span>
              {notices.length > 0 ? (
                <button
                  className="linkish"
                  onClick={async () => {
                    apply(await api.clearNotices())
                    setOpen(false)
                  }}
                >
                  Clear
                </button>
              ) : null}
            </div>

            {notices.length === 0 ? (
              <p className="notices-none">Nothing yet.</p>
            ) : (
              <div className="notices-list">
                {notices.map((notice) => {
                  const mark = MARK[notice.kind]
                  return (
                    <button
                      className="notice"
                      key={notice.id}
                      onClick={() => {
                        if (notice.view) onGo(notice.view)
                        setOpen(false)
                      }}
                    >
                      <span className={`notice-mark ${mark.tone}`}>
                        <Icon name={mark.icon} size={13} />
                      </span>
                      <span className="grow">
                        <span className="notice-title">{notice.title}</span>
                        <span className="notice-body">{notice.body}</span>
                      </span>
                      <span className="when">{relative(notice.at)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
