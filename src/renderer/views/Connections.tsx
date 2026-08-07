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
      <div className="notice info">{spec.note}</div>

      <button className="btn" onClick={() => void api.openExternal(spec.setupUrl)}>
        <Icon name="external" size={14} />
        Open {spec.name} developer settings
      </button>

      {oauth ? (
        <>
          <Field label="Redirect URI">
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
            <Field label="Client secret">
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
        <Field label={spec.tokenLabel ?? 'Token'}>
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
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    void api.redirectUri().then(setRedirectUri)
    void api.syncConnections().then(apply)
  }, [apply])

  const connected = state.connections.filter((entry) => entry.status === 'connected')
  const liveIds = new Set(connected.map((entry) => entry.providerId))

  const visible = CONNECTORS.filter((spec) => {
    if (filter === 'connected' && !liveIds.has(spec.id)) return false
    if (filter !== 'all' && filter !== 'connected' && spec.category !== filter) return false
    if (!query.trim()) return true
    const needle = query.toLowerCase()
    return (
      spec.name.toLowerCase().includes(needle) ||
      spec.category.toLowerCase().includes(needle) ||
      spec.actions.some((action) => action.label.toLowerCase().includes(needle))
    )
  })

  return (
    <>
      <div className="topbar">
        <h2>Connections</h2>
      </div>

      <div className="scroll">
        <div className="body wide">
          <div className="picker-search boxed big">
            <Icon name="search" size={16} />
            <input
              type="text"
              value={query}
              spellCheck={false}
              placeholder="Search apps and actions"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {/* Counts live on the filters themselves, so the shape of the
              catalogue is legible before you touch anything. */}
          <div className="filters">
            <button className="filter" data-on={filter === 'all'} onClick={() => setFilter('all')}>
              All <span>{CONNECTORS.length}</span>
            </button>
            <button
              className="filter"
              data-on={filter === 'connected'}
              onClick={() => setFilter('connected')}
            >
              Connected <span>{connected.length}</span>
            </button>
            {CATEGORIES.map((category) => {
              const count = CONNECTORS.filter((spec) => spec.category === category).length
              if (count === 0) return null
              return (
                <button
                  key={category}
                  className="filter"
                  data-on={filter === category}
                  onClick={() => setFilter(category)}
                >
                  {category} <span>{count}</span>
                </button>
              )
            })}
          </div>

          {filter === 'all' && !query.trim() ? (
            <div className="tool-list">
              <div className="tool-row" data-live="true">
                <span className="logo">
                  <BrandMark id="apple" size={22} />
                </span>
                <span className="grow">
                  <span className="tool-name">Calendar, Reminders, Notes &amp; Mail</span>
                </span>
                <span className="pill on">
                  <Icon name="check" size={12} strokeWidth={2.4} />
                  Built in
                </span>
              </div>

              <div className="tool-row" data-live={state.settings.attentionEnabled}>
                <span className="logo">
                  <Icon name="attention" size={20} />
                </span>
                <span className="grow">
                  <span className="tool-name">Attention ledger</span>
                </span>
                <button
                  className={state.settings.attentionEnabled ? 'pill on' : 'pill add'}
                  onClick={async () =>
                    apply(
                      await api.updateSettings({
                        attentionEnabled: !state.settings.attentionEnabled
                      })
                    )
                  }
                >
                  {state.settings.attentionEnabled ? (
                    <>
                      <Icon name="check" size={12} strokeWidth={2.4} />
                      Recording
                    </>
                  ) : (
                    'Start'
                  )}
                </button>
              </div>
            </div>
          ) : null}

          <div className="tool-list">
            {visible.map((spec) => {
              const connection = state.connections.find((entry) => entry.providerId === spec.id)
              const live = connection?.status === 'connected'

              return (
                <div className="tool-row" key={spec.id} data-live={live}>
                  <span className="logo">
                    <BrandMark id={spec.id} name={spec.name} size={22} />
                  </span>

                  <span className="grow">
                    <span className="tool-name">{spec.name}</span>
                    {connection?.status === 'error' && connection.error ? (
                      <span className="tool-err">{connection.error}</span>
                    ) : (
                      <span className="tool-meta">
                        {spec.actions.length} actions
                        {live && connection?.account ? ` · ${connection.account}` : ''}
                      </span>
                    )}
                  </span>

                  {live ? (
                    <button
                      className="pill on"
                      onClick={async () => apply(await api.disconnect(spec.id))}
                      title="Disconnect"
                    >
                      <Icon name="check" size={12} strokeWidth={2.4} />
                      Connected
                    </button>
                  ) : (
                    <button className="pill add" onClick={() => setSetup(spec)} aria-label={`Connect ${spec.name}`}>
                      <Icon name="plus" size={14} />
                    </button>
                  )}
                </div>
              )
            })}

            {visible.length === 0 ? <p className="quiet tool-none">Nothing matches.</p> : null}
          </div>
        </div>
      </div>

      {setup ? (
        <Setup spec={setup} redirectUri={redirectUri} onClose={() => setSetup(null)} />
      ) : null}
    </>
  )
}
