import type { ReactNode } from 'react'
import type { Profile, Settings as SettingsShape } from '@shared/types'
import { MODELS } from '@shared/models'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Icon } from '../components/Icon'
import { Field, LiveInput, Switch } from '../components/ui'

/**
 * Settings holds what Grove is like, not what it runs on. Credentials live in
 * Providers and Connections, which is where you go to add one — duplicating an
 * API key field here only made it unclear which of the two was authoritative.
 */
export const Settings = (): ReactNode => {
  const { state, apply } = useStore()

  const set = async (patch: Partial<SettingsShape>): Promise<void> => {
    apply(await api.updateSettings(patch))
  }

  const setProfile = async (patch: Partial<Profile>): Promise<void> => {
    apply(await api.updateProfile(patch))
  }

  return (
    <>
      <div className="topbar">
        <h2>Settings</h2>
      </div>

      <div className="scroll">
        <div className="body">
          <section className="block">
            <div className="block-head">
              <h3>You</h3>
            </div>
            <div className="card stack">
              <div className="pair">
                <Field label="Name">
                  <LiveInput
                    value={state.profile.name}
                    onCommit={(value) => void setProfile({ name: value })}
                  />
                </Field>
                <Field label="Role">
                  <LiveInput
                    value={state.profile.role}
                    onCommit={(value) => void setProfile({ role: value })}
                  />
                </Field>
              </div>
              <Field label="Company">
                <LiveInput
                  value={state.profile.venture}
                  onCommit={(value) => void setProfile({ venture: value })}
                />
              </Field>
              <Field label="Mission">
                <LiveInput
                  multiline
                  value={state.profile.mission}
                  onCommit={(value) => void setProfile({ mission: value })}
                />
              </Field>
              <Field label="How you want to be run">
                <LiveInput
                  multiline
                  value={state.profile.operatingStyle}
                  onCommit={(value) => void setProfile({ operatingStyle: value })}
                />
              </Field>
            </div>
          </section>

          <section className="block">
            <div className="block-head">
              <h3>Defaults for new agents</h3>
            </div>
            <div className="card stack">
              <div className="pair">
                <Field label="Model">
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
                <Field label="Reasoning">
                  <select
                    value={state.settings.effort}
                    onChange={(event) =>
                      void set({ effort: event.target.value as SettingsShape['effort'] })
                    }
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </Field>
              </div>
            </div>
          </section>

          <section className="block">
            <div className="block-head">
              <h3>Behaviour</h3>
            </div>
            <div className="card">
              <div className="toggle">
                <span className="grow">Show reasoning</span>
                <Switch
                  on={state.settings.showThinking}
                  onChange={(value) => void set({ showThinking: value })}
                  label="Show reasoning"
                />
              </div>
              <div className="toggle">
                <span className="grow">Automations</span>
                <Switch
                  on={state.settings.automationsEnabled}
                  onChange={(value) => void set({ automationsEnabled: value })}
                  label="Automations"
                />
              </div>
              <div className="toggle">
                <span className="grow">Menu bar &amp; ⌥Space</span>
                <Switch
                  on={state.settings.menuBarEnabled}
                  onChange={(value) => void set({ menuBarEnabled: value })}
                  label="Menu bar"
                />
              </div>
              <div className="toggle">
                <span className="grow">Attention ledger</span>
                <Switch
                  on={state.settings.attentionEnabled}
                  onChange={(value) => void set({ attentionEnabled: value })}
                  label="Attention ledger"
                />
              </div>
              <div className="toggle">
                <span className="grow">Theme</span>
                <select
                  className="inline"
                  value={state.settings.theme}
                  onChange={(event) =>
                    void set({ theme: event.target.value as SettingsShape['theme'] })
                  }
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
            </div>
          </section>

          {state.memories.length > 0 ? (
            <section className="block">
              <div className="block-head">
                <h3>Memory</h3>
                <span className="counter">{state.memories.length}</span>
              </div>
              <div className="list">
                {state.memories
                  .slice()
                  .reverse()
                  .map((memory) => (
                    <div className="line" key={memory.id}>
                      <span className="tag">{memory.tag}</span>
                      <span className="grow">{memory.text}</span>
                      <button
                        className="icon-btn danger"
                        onClick={async () => apply(await api.deleteMemory(memory.id))}
                        aria-label="Forget"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  )
}
