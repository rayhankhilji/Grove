import { useEffect, useState, type ReactNode } from 'react'
import { PROVIDERS, type ProviderSpec } from '@shared/providers'
import { PERSONAS } from '@shared/personas'
import { api } from '../lib/api'
import type { FishVoice, PlanStatus } from '../../preload'
import { useStore } from '../lib/state'
import { Icon } from '../components/Icon'
import { BrandMark } from '../components/Brand'
import { Field, Sheet, Switch } from '../components/ui'

const price = (input?: number, output?: number): string => {
  if (input === undefined) return ''
  if (input === 0) return 'free · local'
  return `$${input} / $${output}`
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

/**
 * The plan half of a provider card.
 *
 * A subscription is reached through the vendor's own CLI, which is already
 * signed in — so the only things Grove can usefully report are whether that
 * command exists and whether it has a session.
 */
const PlanRow = ({
  spec,
  status,
  onRecheck
}: {
  spec: ProviderSpec
  status: PlanStatus | undefined
  onRecheck: () => void
}): ReactNode => {
  const subscription = spec.subscription!

  if (!status?.installed) {
    return (
      <div className="stack tight">
        <p className="muted">
          Needs the <code>{subscription.command}</code> command, which is not on this Mac yet.
        </p>
        <div className="code-row">
          <code>{subscription.install}</code>
          <button
            className="icon-btn"
            aria-label="Copy install command"
            onClick={() => void navigator.clipboard.writeText(subscription.install)}
          >
            <Icon name="copy" size={13} />
          </button>
        </div>
        <div className="row">
          <button className="btn" onClick={() => void api.openExternal(subscription.installUrl)}>
            <Icon name="external" size={13} />
            Installation guide
          </button>
          <button className="btn" onClick={onRecheck}>
            <Icon name="retry" size={13} />
            Check again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="stack tight">
      <p className="muted">{subscription.signIn}</p>
      <div className="row">
        <span className="tag mono">{status.path}</span>
        <button className="btn tiny" onClick={onRecheck}>
          <Icon name="retry" size={12} />
          Recheck
        </button>
      </div>
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
        created yourself. Grove will not help you clone a real person's voice to put words in their
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
  const [plans, setPlans] = useState<Record<string, PlanStatus>>({})
  const [hasVoice, setHasVoice] = useState(false)
  const [fishKey, setFishKey] = useState('')
  const [picker, setPicker] = useState(false)

  const refresh = (): void => {
    void api.configuredProviders().then(setConfigured)
    void api.providerPlans().then(setPlans)
    void api.hasVoiceKey().then(setHasVoice)
  }

  useEffect(refresh, [])

  const authOf = (spec: ProviderSpec): 'api' | 'subscription' =>
    state.settings.providerAuth[spec.id] === 'subscription' && spec.subscription
      ? 'subscription'
      : 'api'

  /** A provider is usable when the route it is set to actually resolves. */
  const isReady = (spec: ProviderSpec): boolean => {
    if (spec.keyless) return true
    if (authOf(spec) === 'subscription') return Boolean(plans[spec.id]?.installed)
    return configured.includes(spec.id)
  }

  const ready = PROVIDERS.filter(isReady).length
  const mapped = Object.keys(state.settings.personaVoices).length

  return (
    <>
      <div className="topbar">
        <h2>Providers</h2>
        <span className="sub">
          {ready} of {PROVIDERS.length} ready
        </span>
      </div>

      <div className="scroll">
        <div className="body">
          {PROVIDERS.map((spec) => {
            const mode = authOf(spec)
            const live = isReady(spec)
            const plan = plans[spec.id]

            return (
              <div className="provider" key={spec.id} data-ready={live}>
                <div className="provider-head">
                  <div className="logo">
                    <BrandMark id={spec.id} name={spec.name} size={22} />
                  </div>

                  <div className="grow">
                    <div className="row">
                      <span className="name">{spec.name}</span>
                      {live ? (
                        <span className="tag ok">
                          <span className="dot ok" />
                          {spec.keyless
                            ? 'local'
                            : mode === 'subscription'
                              ? plan?.signedIn
                                ? 'on your plan'
                                : 'CLI found'
                              : 'key saved'}
                        </span>
                      ) : null}
                    </div>
                    <div className="wrap-list" style={{ marginTop: 6 }}>
                      {spec.models.map((model) => (
                        <span className="tag" key={model.id}>
                          {model.label}
                          <span className="muted"> {price(model.inPrice, model.outPrice)}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {spec.subscription ? (
                    <div className="seg" role="group" aria-label={`${spec.name} credential`}>
                      <button
                        data-on={mode === 'api'}
                        onClick={async () => apply(await api.setProviderAuth(spec.id, 'api'))}
                      >
                        API key
                      </button>
                      <button
                        data-on={mode === 'subscription'}
                        onClick={async () => apply(await api.setProviderAuth(spec.id, 'subscription'))}
                      >
                        Plan
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="provider-body">
                  {spec.keyless ? (
                    <p className="muted">
                      Runs against Ollama on this Mac. Start it with <code>ollama serve</code>.
                    </p>
                  ) : mode === 'subscription' ? (
                    <PlanRow spec={spec} status={plan} onRecheck={refresh} />
                  ) : (
                    <>
                      <KeyRow
                        providerId={spec.id}
                        configured={configured.includes(spec.id)}
                        onSaved={refresh}
                      />
                      {spec.keyUrl ? (
                        <button
                          className="btn ghost tiny"
                          onClick={() => void api.openExternal(spec.keyUrl)}
                        >
                          <Icon name="external" size={12} />
                          Get a key
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            )
          })}

          <div className="section-title">Boardroom</div>
          <div className="card stack">
            <Field
              label="Model for boardroom seats"
              hint="A long call is many short turns, so this is deliberately separate from the model your agents run on."
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

          <div className="section-title">Speech</div>
          <div className="provider">
            <div className="provider-head">
              <div className="logo">
                <BrandMark id="fish" name="Fish Audio" size={22} />
              </div>
              <div className="grow">
                <div className="row">
                  <span className="name">Fish Audio</span>
                  {hasVoice ? (
                    <span className="tag ok">
                      <span className="dot ok" />
                      key saved
                    </span>
                  ) : null}
                  {mapped > 0 ? <span className="tag">{mapped} seats voiced</span> : null}
                </div>
                <div className="muted" style={{ marginTop: 2 }}>
                  Text to speech. Separate from your model provider — a plan covers the words, not
                  the voices.
                </div>
              </div>
            </div>

            <div className="provider-body">
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
              <div className="row">
                <button
                  className="btn ghost tiny"
                  onClick={() => void api.openExternal('https://fish.audio/go-api/')}
                >
                  <Icon name="external" size={12} />
                  Get a key
                </button>
                <button className="btn tiny" disabled={!hasVoice} onClick={() => setPicker(true)}>
                  <Icon name="sparkle" size={12} />
                  Assign voices to seats
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {picker ? <VoicePicker onClose={() => setPicker(false)} /> : null}
    </>
  )
}
