import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PROVIDERS, type ModelOption, type ProviderSpec } from '@shared/providers'
import { BrandMark } from './Brand'
import { Icon } from './Icon'

/**
 * The model picker.
 *
 * Two columns: a rail of provider marks on the left that filters, and the
 * models themselves on the right. The first nine carry ⌘1–⌘9, and starring a
 * model floats it to the top — because in practice everyone reaches for the
 * same two or three, and hunting a list every time is the thing that makes a
 * picker feel cheap.
 */

export interface ModelPickerProps {
  value: string
  favourites: string[]
  /** Providers with a live credential, so unusable models can be marked. */
  ready: string[]
  onPick: (modelId: string) => void
  onFavourite: (modelId: string) => void
  onClose: () => void
}

interface Entry {
  provider: ProviderSpec
  model: ModelOption
}

const matches = (entry: Entry, query: string): boolean => {
  if (!query) return true
  const needle = query.toLowerCase()
  return (
    entry.model.label.toLowerCase().includes(needle) ||
    entry.model.id.toLowerCase().includes(needle) ||
    entry.provider.name.toLowerCase().includes(needle)
  )
}

export const ModelPicker = ({
  value,
  favourites,
  ready,
  onPick,
  onFavourite,
  onClose
}: ModelPickerProps): ReactNode => {
  const [query, setQuery] = useState('')
  const [rail, setRail] = useState<string | null>(null)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    search.current?.focus()
  }, [])

  const entries = useMemo<Entry[]>(() => {
    const all = PROVIDERS.flatMap((provider) =>
      provider.models.map((model) => ({ provider, model }))
    )
    const scoped = rail ? all.filter((entry) => entry.provider.id === rail) : all
    const found = scoped.filter((entry) => matches(entry, query))
    // Starred first, then the order the catalogue declares — which is already
    // strongest-to-cheapest within each provider.
    return [
      ...found.filter((entry) => favourites.includes(entry.model.id)),
      ...found.filter((entry) => !favourites.includes(entry.model.id))
    ]
  }, [query, rail, favourites])

  // ⌘1–⌘9 pick from what is on screen right now, so the shortcut always means
  // what the list shows rather than a fixed position in the full catalogue.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!event.metaKey || event.key < '1' || event.key > '9') return
      const entry = entries[Number(event.key) - 1]
      if (!entry) return
      event.preventDefault()
      onPick(entry.model.id)
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entries, onPick, onClose])

  return (
    <div className="picker" onMouseDown={(event) => event.stopPropagation()}>
      <div className="picker-rail">
        <button
          className="rail-mark"
          data-on={rail === null}
          aria-label="All providers"
          onClick={() => setRail(null)}
        >
          <Icon name="sparkle" size={17} />
        </button>
        {PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            className="rail-mark"
            data-on={rail === provider.id}
            aria-label={provider.name}
            title={provider.name}
            onClick={() => setRail(rail === provider.id ? null : provider.id)}
          >
            <BrandMark id={provider.id} name={provider.name} size={19} />
          </button>
        ))}
      </div>

      <div className="picker-main">
        <div className="picker-search">
          <Icon name="search" size={15} />
          <input
            ref={search}
            type="text"
            value={query}
            spellCheck={false}
            placeholder="Search models…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="picker-list">
          {entries.length === 0 ? <p className="muted picker-none">No model matches.</p> : null}

          {entries.map((entry, index) => {
            const starred = favourites.includes(entry.model.id)
            const usable = ready.includes(entry.provider.id) || entry.provider.keyless
            return (
              <div
                className="picker-row"
                key={entry.model.id}
                aria-selected={entry.model.id === value}
              >
                <button className="pick" onClick={() => onPick(entry.model.id)}>
                  <span className="grow">
                    <span className="title">
                      {entry.model.label}
                      {entry.model.id === value ? (
                        <span className="tick">
                          <Icon name="check" size={14} />
                        </span>
                      ) : null}
                    </span>
                    <span className="source">
                      <BrandMark id={entry.provider.id} name={entry.provider.name} size={13} />
                      {entry.provider.name}
                      {!usable ? <span className="needs">needs a key</span> : null}
                    </span>
                  </span>
                </button>

                {index < 9 ? <kbd>⌘{index + 1}</kbd> : <kbd className="ghost" />}

                <button
                  className="star"
                  data-on={starred}
                  aria-label={starred ? 'Unstar' : 'Star'}
                  onClick={() => onFavourite(entry.model.id)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.6 9.7l5.8-.8z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                      fill={starred ? 'currentColor' : 'none'}
                    />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
