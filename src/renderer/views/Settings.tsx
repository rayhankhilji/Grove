import { useState, type ReactNode } from 'react'
import type { Profile, Settings as SettingsShape } from '@shared/types'
import { MODELS } from '@shared/models'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Icon } from '../components/Icon'
import { Field, LiveInput, Switch } from '../components/ui'

const CONSOLE_URL = 'https://console.anthropic.com/settings/keys'

export const Settings = (): ReactNode => {
  const { state, apply, keyStatus, setKeyStatus } = useStore()
  const [keyDraft, setKeyDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const set = async (patch: Partial<SettingsShape>): Promise<void> => {
    apply(await api.updateSettings(patch))
  }

  const setProfile = async (patch: Partial<Profile>): Promise<void> => {
    apply(await api.updateProfile(patch))
  }

  const saveKey = async (): Promise<void> => {
    if (!keyDraft.trim()) return
    setSaving(true)
    setKeyStatus(await api.setKey(keyDraft))
    setKeyDraft('')
    setSaving(false)
  }

  return (
    <>
      <div className="topbar">
        <h2>Settings</h2>
      </div>

      <div className="scroll">
        <div className="body">
          <div className="section-title">Anthropic API key</div>
          <div className="card stack">
            {keyStatus.configured ? (
              <div className="split">
                <div>
                  <strong style={{ fontSize: 13 }}>Key set</strong>
                  <p className="muted">
                    Ends in ·{keyStatus.hint} ·{' '}
                    {keyStatus.encrypted
                      ? 'encrypted in your macOS Keychain'
                      : 'held in memory for this session only'}
                  </p>
                </div>
                <button className="btn danger" onClick={async () => setKeyStatus(await api.clearKey())}>
                  Remove
                </button>
              </div>
            ) : (
              <p className="muted">
                Grove runs on your own Anthropic key. It is stored encrypted on this Mac and sent
                only to Anthropic — never to us.
              </p>
            )}

            <Field label={keyStatus.configured ? 'Replace key' : 'API key'} hint="Starts with sk-ant-">
              <div className="row">
                <input
                  className="grow"
                  type="password"
                  value={keyDraft}
                  placeholder="sk-ant-…"
                  spellCheck={false}
                  onChange={(event) => setKeyDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void saveKey()
                  }}
                />
                <button
                  className="btn primary"
                  onClick={() => void saveKey()}
                  disabled={saving || !keyDraft.trim()}
                >
                  Save
                </button>
              </div>
            </Field>

            <span className="muted">
              Need one?{' '}
              <button className="linkish" onClick={() => void api.openExternal(CONSOLE_URL)}>
                Create a key in the Anthropic Console
              </button>
            </span>
          </div>

          <div className="section-title">Defaults</div>
          <div className="card stack">
            <Field
              label="Default model"
              hint={`${MODELS.find((model) => model.id === state.settings.model)?.note ?? ''} Each agent can override this.`}
            >
              <select
                value={state.settings.model}
                onChange={(event) => void set({ model: event.target.value })}
              >
                {MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Effort" hint="How hard agents think before answering. Higher costs more.">
              <select
                value={state.settings.effort}
                onChange={(event) => void set({ effort: event.target.value as SettingsShape['effort'] })}
              >
                <option value="low">Low — quick and cheap</option>
                <option value="medium">Medium — balanced</option>
                <option value="high">High — most considered</option>
              </select>
            </Field>

            <div className="split">
              <div>
                <strong style={{ fontSize: 13 }}>Show reasoning</strong>
                <p className="muted">Stream a summary of how an agent got there.</p>
              </div>
              <Switch
                on={state.settings.showThinking}
                onChange={(value) => void set({ showThinking: value })}
                label="Show reasoning"
              />
            </div>

            <div className="split">
              <div>
                <strong style={{ fontSize: 13 }}>Automations</strong>
                <p className="muted">Master switch for every scheduled workflow.</p>
              </div>
              <Switch
                on={state.settings.automationsEnabled}
                onChange={(value) => void set({ automationsEnabled: value })}
                label="Enable automations"
              />
            </div>

            <div className="split">
              <div>
                <strong style={{ fontSize: 13 }}>Menu bar</strong>
                <p className="muted">
                  Keep Grove in the menu bar with live run status. ⌥Space summons it from anywhere.
                </p>
              </div>
              <Switch
                on={state.settings.menuBarEnabled}
                onChange={(value) => void set({ menuBarEnabled: value })}
                label="Menu bar"
              />
            </div>

            <div className="split">
              <div>
                <strong style={{ fontSize: 13 }}>Attention ledger</strong>
                <p className="muted">
                  Sample which app is frontmost so agents know where your hours went. Application
                  names and durations only — never screen contents.
                </p>
              </div>
              <Switch
                on={state.settings.attentionEnabled}
                onChange={(value) => void set({ attentionEnabled: value })}
                label="Attention ledger"
              />
            </div>

            <Field label="Theme">
              <select
                value={state.settings.theme}
                onChange={(event) => void set({ theme: event.target.value as SettingsShape['theme'] })}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">Match system</option>
              </select>
            </Field>
          </div>

          <div className="section-title">You</div>
          <div className="card stack">
            <p className="muted">
              Everything here goes into every agent's context. The more it knows, the less you repeat.
            </p>
            <Field label="Name">
              <LiveInput value={state.profile.name} onCommit={(value) => void setProfile({ name: value })} />
            </Field>
            <Field label="Role">
              <LiveInput
                value={state.profile.role}
                placeholder="founder, head of product…"
                onCommit={(value) => void setProfile({ role: value })}
              />
            </Field>
            <Field label="Venture">
              <LiveInput
                value={state.profile.venture}
                onCommit={(value) => void setProfile({ venture: value })}
              />
            </Field>
            <Field label="Mission">
              <LiveInput
                multiline
                value={state.profile.mission}
                placeholder="What you are ultimately trying to do"
                onCommit={(value) => void setProfile({ mission: value })}
              />
            </Field>
            <Field label="How you want to be run" hint="Pace, directness, how often it should push back.">
              <LiveInput
                multiline
                value={state.profile.operatingStyle}
                onCommit={(value) => void setProfile({ operatingStyle: value })}
              />
            </Field>
          </div>

          <div className="section-title">Memory · {state.memories.length}</div>
          <div className="card stack tight">
            {state.memories.length === 0 ? (
              <p className="muted">
                Nothing remembered yet. Agents save durable facts about you as you work.
              </p>
            ) : (
              state.memories
                .slice()
                .reverse()
                .map((memory) => (
                  <div className="split" key={memory.id}>
                    <div className="grow">
                      <span className="tag">{memory.tag}</span>
                      <p style={{ fontSize: 13, marginTop: 5 }}>{memory.text}</p>
                    </div>
                    <button
                      className="icon-btn danger"
                      onClick={async () => apply(await api.deleteMemory(memory.id))}
                      aria-label="Forget"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </>
  )
}
