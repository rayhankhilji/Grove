import { useMemo, useState, type ReactNode } from 'react'
import type { BrainEntry } from '@shared/types'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Icon } from '../components/Icon'
import { Empty, Field, Sheet, relative } from '../components/ui'

const Editor = ({
  entry,
  onClose
}: {
  entry: BrainEntry | null
  onClose: () => void
}): ReactNode => {
  const { apply } = useStore()
  const [title, setTitle] = useState(entry?.title ?? '')
  const [body, setBody] = useState(entry?.body ?? '')
  const [tags, setTags] = useState(entry?.tags.join(', ') ?? '')

  const save = async (): Promise<void> => {
    const list = tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
    apply(
      entry
        ? await api.updateBrain(entry.id, { title, body, tags: list })
        : await api.addBrain(title, body, list)
    )
    onClose()
  }

  return (
    <Sheet
      title={entry ? 'Edit knowledge' : 'Add to the brain'}
      onClose={onClose}
      actions={
        <>
          {entry ? (
            <button
              className="btn danger"
              onClick={async () => {
                apply(await api.deleteBrain(entry.id))
                onClose()
              }}
            >
              Delete
            </button>
          ) : null}
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!title.trim() || !body.trim()}
            onClick={() => void save()}
          >
            Save
          </button>
        </>
      }
    >
      <Field label="Title" hint="How an agent will recognise this when searching.">
        <input
          type="text"
          value={title}
          placeholder="Pricing and packaging"
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field label="Knowledge" hint="Write it so it stands alone with no other context.">
        <textarea
          rows={12}
          value={body}
          placeholder="We charge $49/seat/month with a 14-day trial. Enterprise starts at $2k/month…"
          onChange={(event) => setBody(event.target.value)}
        />
      </Field>
      <Field label="Tags" hint="Comma separated. Helps retrieval.">
        <input
          type="text"
          value={tags}
          placeholder="pricing, revenue"
          onChange={(event) => setTags(event.target.value)}
        />
      </Field>
    </Sheet>
  )
}

export const Brain = (): ReactNode => {
  const { state, apply } = useStore()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<BrainEntry | null>(null)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)

  const visible = useMemo(() => {
    const needle = query.toLowerCase().trim()
    const rows = needle
      ? state.brain.filter(
          (entry) =>
            entry.title.toLowerCase().includes(needle) ||
            entry.body.toLowerCase().includes(needle) ||
            entry.tags.some((tag) => tag.toLowerCase().includes(needle))
        )
      : state.brain
    return [...rows].sort((a, b) => Number(b.pinned) - Number(a.pinned))
  }, [state.brain, query])

  const pinned = state.brain.filter((entry) => entry.pinned).length

  return (
    <>
      <div className="topbar">
        <h2>Brain</h2>
        <span className="sub">
          {state.brain.length} entries{pinned > 0 ? ` · ${pinned} pinned` : ''}
        </span>
        <div className="spacer" />
        <div className="row">
          <button
            className="btn"
            disabled={importing}
            onClick={async () => {
              setImporting(true)
              apply(await api.importBrain())
              setImporting(false)
            }}
          >
            <Icon name="doc" size={14} />
            {importing ? 'Reading…' : 'Import files'}
          </button>
          <button className="btn primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} />
            Add
          </button>
        </div>
      </div>

      <div className="scroll">
        <div className="body">
          <div className="notice info">
            Everything here is available to every agent and every boardroom seat. Explain something
            once — your pricing, your positioning, last quarter's numbers — and you never retype it
            into a prompt again. Pinned entries ride along in every conversation.
          </div>

          {state.brain.length > 0 ? (
            <input
              type="text"
              value={query}
              placeholder="Search the brain…"
              onChange={(event) => setQuery(event.target.value)}
            />
          ) : null}

          {state.brain.length === 0 ? (
            <Empty icon="memory" title="The brain is empty.">
              Add what you would otherwise explain over and over: what you sell, who buys it, what
              you tried that failed, your numbers, your positioning. Import a doc or a deck and it
              becomes context for everything.
            </Empty>
          ) : (
            visible.map((entry) => (
              <div className="card" key={entry.id}>
                <div className="split">
                  <div className="grow">
                    <div className="row">
                      {entry.pinned ? (
                        <span className="tag accent">
                          <Icon name="sparkle" size={10} />
                          pinned
                        </span>
                      ) : null}
                      <strong style={{ fontSize: 13.5 }}>{entry.title}</strong>
                    </div>
                    <p className="muted" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                      {entry.body.length > 320 ? `${entry.body.slice(0, 320)}…` : entry.body}
                    </p>
                    <div className="pill-list">
                      {entry.tags.map((tag) => (
                        <span className="tag" key={tag}>
                          {tag}
                        </span>
                      ))}
                      <span className="tag">
                        {entry.source} · {relative(entry.updatedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="row">
                    <button
                      className="icon-btn"
                      aria-label={entry.pinned ? 'Unpin' : 'Pin'}
                      style={{ color: entry.pinned ? 'var(--accent)' : undefined }}
                      onClick={async () =>
                        apply(await api.updateBrain(entry.id, { pinned: !entry.pinned }))
                      }
                    >
                      <Icon name="sparkle" size={15} />
                    </button>
                    <button className="btn tiny" onClick={() => setEditing(entry)}>
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {adding || editing ? (
        <Editor
          entry={editing}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}
