import { useEffect, useState, type ReactNode } from 'react'
import { PROVIDERS } from '@shared/providers'
import { PERSONAS } from '@shared/personas'
import { api } from '../lib/api'
import type { FishVoice } from '../../preload'
import { useStore } from '../lib/state'
import { Icon } from '../components/Icon'
import { Field, Sheet, Switch } from '../components/ui'

const price = (input?: number, output?: number): string => {
  if (input === undefined) return ''
  if (input === 0) return 'free · local'
  return `$${input}/$${output} per Mtok`
}

const KeyRow = ({
  providerId,
  configured,
  onSaved
}: {
  providerId: string
  configured: boolean
  onSaved: () => void
}): ReactNode => {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const { apply } = useStore()

  const save = async (): Promise<void> => {
    setBusy(true)
    apply(await api.setProviderKey(providerId, draft))
    setDraft('')
    setBusy(false)
    onSaved()
  }

  return (
    <div className="row">
      <input
        className="grow"
        type="password"
        value={draft}
        spellCheck={false}
        placeholder={configured ? 'Replace key…' : 'Paste API key'}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void save()
        }}
      />
      <button className="btn" disabled={busy || !draft.trim()} onClick={() => void save()}>
        Save
      </button>
    </div>
  )
}

/** Maps a Fish Audio voice to a boardroom seat. */
const VoicePicker = ({ onClose }: { onClose: () => void }): ReactNode => {
  const { state, apply } = useStore()
  const [query, setQuery] = useState('')
  const [voices, setVoices] = useState<FishVoice[]>([])
  const [target, setTarget] = useState<string>(PERSONAS[0]!.id)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const search = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      setVoices(await api.listVoices(query))
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void search()
  }, [])

  const assign = async (voiceId: string): Promise<void> => {
    apply(
      await api.updateSettings({
        personaVoices: { ...state.settings.personaVoices, [target]: voiceId }
      })
    )
  }

  return (
    <Sheet
      title="Assign voices"
      onClose={onClose}
      actions={
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="notice info">
        Use voices you have the right to use — Fish's licensed marketplace voices, or models you
        created yourself. Stobs will not help you clone a real person's voice to put words in their
        mouth, and the personas are always labelled as interpretations.
      </div>

      <Field label="Seat">
        <select value={target} onChange={(event) => setTarget(event.target.value)}>
          {PERSONAS.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.name}
              {state.settings.personaVoices[persona.id] ? ' ✓' : ''}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Search your Fish Audio voices">
        <div className="row">
          <input
            className="grow"
            type="text"
            value={query}
            placeholder="Voice name…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void search()
            }}
          />
          <button className="btn" onClick={() => void search()} disabled={busy}>
            <Icon name="search" size={14} />
          </button>
        </div>
      </Field>

      {error ? <div className="notice">{error}</div> : null}

      <div className="stack tight" style={{ maxHeight: 280, overflowY: 'auto' }}>
        {voices.map((voice) => {
          const assigned = state.settings.personaVoices[target] === voice.id
          return (
            <div className="split" key={voice.id}>
              <div className="grow">
                <strong style={{ fontSize: 12.5 }}>{voice.title}</strong>
                <div className="muted">
                  {voice.author} · {voice.languages.join(', ') || 'any'} · {voice.visibility}
                </div>
              </div>
              <button
                className={`btn tiny${assigned ? ' primary' : ''}`}
                onClick={() => void assign(voice.id)}
              >
                {assigned ? 'Assigned' : 'Use'}
              </button>
            </div>
          )
        })}
        {voices.length === 0 && !busy ? (
          <p className="muted">No voices found on this account.</p>
        ) : null}
      </div>

      <Field label="Or paste a voice id directly">
        <input
          type="text"
          placeholder="Fish model id"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void assign(event.currentTarget.value.trim())
              event.currentTarget.value = ''
            }
          }}
        />
      </Field>
    </Sheet>
  )
}

export const Providers = (): ReactNode => {
  const { state, apply } = useStore()
  const [configured, setConfigured] = useState<string[]>([])
  const [hasVoice, setHasVoice] = useState(false)
  const [fishKey, setFishKey] = useState('')
  const [picker, setPicker] = useState(false)

  const refresh = (): void => {
    void api.configuredProviders().then(setConfigured)
    void api.hasVoiceKey().then(setHasVoice)
  }

  useEffect(refresh, [])

  const mapped = Object.keys(state.settings.personaVoices).length

  return (
    <>
      <div className="topbar">
        <h2>Providers</h2>
        <span className="sub">
          {configured.length} of {PROVIDERS.length} configured
        </span>
      </div>

      <div className="scroll">
        <div className="body">
          <div className="notice info">
            Agents and boardroom seats can run on any of these. Cheap models make long autonomous
            work and multi-hour calls affordable; keep Claude for judgement.
          </div>

          <div className="section-title">Models</div>
          {PROVIDERS.map((provider) => {
            const ready = configured.includes(provider.id) || Boolean(provider.keyless)
            return (
              <div className="card stack tight" key={provider.id}>
                <div className="split">
                  <div className="grow">
                    <div className="row">
                      <strong style={{ fontSize: 13.5 }}>{provider.name}</strong>
                      {ready ? (
                        <span className="tag ok">
                          <span className="dot ok" />
                          {provider.keyless ? 'local' : 'ready'}
                        </span>
                      ) : null}
                    </div>
                    <div className="muted">{provider.blurb}</div>
                  </div>
                  {provider.keyUrl ? (
                    <button className="btn tiny" onClick={() => void api.openExternal(provider.keyUrl)}>
                      <Icon name="external" size={12} />
                      Get key
                    </button>
                  ) : null}
                </div>

                <div className="wrap-list">
                  {provider.models.map((model) => (
                    <span className="tag" key={model.id}>
                      {model.label} · {price(model.inPrice, model.outPrice)}
                    </span>
                  ))}
                </div>

                {!provider.keyless ? (
                  <KeyRow providerId={provider.id} configured={ready} onSaved={refresh} />
                ) : (
                  <p className="muted">
                    Runs against Ollama on this Mac. Start it with <code>ollama serve</code>.
                  </p>
                )}
              </div>
            )
          })}

          <div className="section-title">Boardroom</div>
          <div className="card stack">
            <Field
              label="Model for boardroom seats"
              hint="A long call is many short turns. Cheap, fast models are the right tool here."
            >
              <select
                value={state.settings.boardroomModel}
                onChange={async (event) =>
                  apply(await api.updateSettings({ boardroomModel: event.target.value }))
                }
              >
                {PROVIDERS.flatMap((provider) =>
                  provider.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {provider.name} · {model.label} — {price(model.inPrice, model.outPrice)}
                    </option>
                  ))
                )}
              </select>
            </Field>

            <div className="split">
              <div>
                <strong style={{ fontSize: 13 }}>Speak turns aloud</strong>
                <p className="muted">
                  Renders each contribution through Fish Audio using the voice mapped to that seat.
                </p>
              </div>
              <Switch
                on={state.settings.voiceEnabled}
                onChange={async (value) => apply(await api.updateSettings({ voiceEnabled: value }))}
                label="Voice"
              />
            </div>
          </div>

          <div className="section-title">Fish Audio</div>
          <div className="card stack">
            <div className="split">
              <div className="grow">
                <div className="row">
                  <strong style={{ fontSize: 13.5 }}>Fish Audio</strong>
                  {hasVoice ? (
                    <span className="tag ok">
                      <span className="dot ok" />
                      ready
                    </span>
                  ) : null}
                  {mapped > 0 ? <span className="tag">{mapped} seats voiced</span> : null}
                </div>
                <div className="muted">Text to speech for boardroom calls.</div>
              </div>
              <button className="btn tiny" onClick={() => void api.openExternal('https://fish.audio/go-api/')}>
                <Icon name="external" size={12} />
                Get key
              </button>
            </div>

            <div className="row">
              <input
                className="grow"
                type="password"
                value={fishKey}
                spellCheck={false}
                placeholder={hasVoice ? 'Replace key…' : 'Fish Audio API key'}
                onChange={(event) => setFishKey(event.target.value)}
              />
              <button
                className="btn"
                disabled={!fishKey.trim()}
                onClick={async () => {
                  await api.setVoiceKey(fishKey)
                  setFishKey('')
                  refresh()
                }}
              >
                Save
              </button>
            </div>

            <button className="btn" disabled={!hasVoice} onClick={() => setPicker(true)}>
              <Icon name="sparkle" size={14} />
              Assign voices to seats
            </button>
          </div>
        </div>
      </div>

      {picker ? <VoicePicker onClose={() => setPicker(false)} /> : null}
    </>
  )
}
