import { useEffect, useState, type ReactNode } from 'react'
import type { ConnectorSpec } from '@shared/types'
import { CONNECTORS } from '@shared/connectors'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Icon } from '../components/Icon'
import { BrandMark } from '../components/Brand'
import { Field, Sheet } from '../components/ui'

const CATEGORIES = [
  'Email',
  'Calendar',
  'Messaging',
  'Work',
  'Files',
  'Money',
  'Customers',
  'Dev',
  'Social',
  'Research'
] as const

const Setup = ({
  spec,
  redirectUri,
  onClose
}: {
  spec: ConnectorSpec
  redirectUri: string
  onClose: () => void
}): ReactNode => {
  const { apply } = useStore()
  const [clientId, setClientId] = useState('')
  const [secret, setSecret] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const oauth = spec.auth === 'oauth'

  const go = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const next = oauth
        ? await api.saveOAuthApp(spec.id, clientId, secret).then(() => api.connect(spec.id))
        : await api.connectWithToken(spec.id, token)
      apply(next)
      const connection = next.connections.find((entry) => entry.providerId === spec.id)
      if (connection?.status === 'error') setError(connection.error ?? 'Could not connect.')
      else onClose()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={`Connect ${spec.name}`}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy || (oauth ? !clientId.trim() : !token.trim())}
            onClick={() => void go()}
          >
            {busy ? 'Connecting…' : oauth ? 'Authorise in browser' : 'Connect'}
          </button>
        </>
      }
    >
      <p className="muted">{spec.note}</p>

      <button className="btn" onClick={() => void api.openExternal(spec.setupUrl)}>
        <Icon name="external" size={14} />
        Open {spec.name} developer settings
      </button>

      {oauth ? (
        <>
          <Field
            label="Redirect URI"
            hint="Paste this into your OAuth app exactly. Grove listens here during the handshake."
          >
            <div className="row">
              <input type="text" readOnly value={redirectUri} className="grow" />
              <button
                className="btn"
                onClick={async () => {
                  await navigator.clipboard.writeText(redirectUri)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1600)
                }}
              >
                <Icon name={copied ? 'check' : 'copy'} size={14} />
              </button>
            </div>
          </Field>

          <Field label="Client ID">
            <input
              type="text"
              value={clientId}
              spellCheck={false}
              placeholder="From your OAuth app"
              onChange={(event) => setClientId(event.target.value)}
            />
          </Field>

          {spec.needsSecret ? (
            <Field
              label="Client secret"
              hint="Stored encrypted in your macOS Keychain and only ever sent to this provider."
            >
              <input
                type="password"
                value={secret}
                spellCheck={false}
                onChange={(event) => setSecret(event.target.value)}
              />
            </Field>
          ) : null}

          <Field label="Scopes requested">
            <div className="wrap-list">
              {(spec.scopes ?? []).map((scope) => (
                <span className="tag" key={scope}>
                  {scope.split('/').pop()}
                </span>
              ))}
            </div>
          </Field>
        </>
      ) : (
        <Field
          label={spec.tokenLabel ?? 'Token'}
          hint="Stored encrypted in your macOS Keychain. Grove verifies it before saving."
        >
          <input
            type="password"
            value={token}
            spellCheck={false}
            placeholder="Paste your token"
            onChange={(event) => setToken(event.target.value)}
          />
        </Field>
      )}

      {error ? <div className="notice">{error}</div> : null}
    </Sheet>
  )
}

export const Connections = (): ReactNode => {
  const { state, apply } = useStore()
  const [setup, setSetup] = useState<ConnectorSpec | null>(null)
  const [redirectUri, setRedirectUri] = useState('')

  useEffect(() => {
    void api.redirectUri().then(setRedirectUri)
    void api.syncConnections().then(apply)
  }, [apply])

  const connected = state.connections.filter((entry) => entry.status === 'connected').length

  return (
    <>
      <div className="topbar">
        <h2>Connections</h2>
        <span className="sub">
          {connected} of {CONNECTORS.length} connected
        </span>
      </div>

      <div className="scroll">
        <div className="body wide">
          <div className="notice info">
            Grove connects with your own OAuth apps and tokens. Nothing routes through our servers —
            credentials live encrypted in your macOS Keychain and go only to the provider.
          </div>

          <div className="section-title">On this Mac</div>
          <div className="stack tight">
            <div className="conn" data-live="true">
              <div className="logo">
                <BrandMark id="apple" size={20} />
              </div>
              <div className="grow">
                <div className="row">
                  <span className="name">Calendar, Reminders, Notes &amp; Mail</span>
                  <span className="tag ok">
                    <span className="dot ok" />
                    built in
                  </span>
                </div>
                <div className="muted">
                  11 actions against the Apple apps already signed in here — no OAuth, no cloud round
                  trip. macOS asks your permission the first time an agent reaches each app.
                </div>
              </div>
            </div>

            <div className="conn">
              <div className="logo">
                <Icon name="today" size={19} />
              </div>
              <div className="grow">
                <div className="row">
                  <span className="name">Attention ledger</span>
                  <span className={`tag ${state.settings.attentionEnabled ? 'ok' : ''}`}>
                    <span className={`dot ${state.settings.attentionEnabled ? 'ok' : ''}`} />
                    {state.settings.attentionEnabled ? 'recording' : 'off'}
                  </span>
                </div>
                <div className="muted">
                  Records which app is frontmost and for how long, so agents can hold your hours
                  against your objectives. Never captures screen contents.
                </div>
              </div>
              <button
                className="btn"
                onClick={async () =>
                  apply(
                    await api.updateSettings({ attentionEnabled: !state.settings.attentionEnabled })
                  )
                }
              >
                {state.settings.attentionEnabled ? 'Stop' : 'Start'}
              </button>
            </div>
          </div>

          {CATEGORIES.map((category) => {
            const group = CONNECTORS.filter((spec) => spec.category === category)
            if (group.length === 0) return null

            return (
              <div key={category}>
                <div className="section-title">{category}</div>
                <div className="conn-grid">
                  {group.map((spec) => {
                    const connection = state.connections.find((entry) => entry.providerId === spec.id)
                    const live = connection?.status === 'connected'

                    return (
                      <div className="conn" key={spec.id} data-live={live}>
                        <div className="logo">
                          <BrandMark id={spec.id} name={spec.name} size={20} />
                        </div>

                        <div className="grow">
                          <div className="row">
                            <span className="name">{spec.name}</span>
                            {live ? (
                              <span className="tag ok">
                                <span className="dot ok" />
                                {connection?.account ?? 'connected'}
                              </span>
                            ) : connection?.status === 'error' ? (
                              <span className="tag bad">error</span>
                            ) : null}
                          </div>
                          <div className="muted">
                            {connection?.status === 'error' && connection.error
                              ? connection.error
                              : `${spec.actions.length} actions · ${spec.actions.filter((action) => action.write).length} can write`}
                          </div>
                        </div>

                        {live ? (
                          <button
                            className="btn"
                            onClick={async () => apply(await api.disconnect(spec.id))}
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button className="btn primary" onClick={() => setSetup(spec)}>
                            Connect
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <p className="muted" style={{ marginTop: 6 }}>
            Once a provider is connected its actions become available to your agents — open an agent
            and switch on the ones it should be allowed to use.
          </p>
        </div>
      </div>

      {setup ? (
        <Setup spec={setup} redirectUri={redirectUri} onClose={() => setSetup(null)} />
      ) : null}
    </>
  )
}
