import { useEffect, useState, type ReactNode } from 'react'
import { api } from './lib/api'
import { useStore } from './lib/state'
import { Icon, type IconName } from './components/Icon'
import { Agents } from './views/Agents'
import { Attention } from './views/Attention'
import { Automations } from './views/Automations'
import { Boardroom } from './views/Boardroom'
import { Brain } from './views/Brain'
import { Chat } from './views/Chat'
import { Connections } from './views/Connections'
import { Decisions } from './views/Decisions'
import { Objectives } from './views/Objectives'
import { Providers } from './views/Providers'
import { Settings } from './views/Settings'
import { Today } from './views/Today'

type View =
  | 'today'
  | 'chat'
  | 'boardroom'
  | 'agents'
  | 'automations'
  | 'connections'
  | 'attention'
  | 'brain'
  | 'objectives'
  | 'decisions'
  | 'providers'
  | 'settings'

const NAV: { id: View; label: string; icon: IconName; group: number }[] = [
  { id: 'today', label: 'Today', icon: 'today', group: 0 },
  { id: 'chat', label: 'Chat', icon: 'chat', group: 0 },
  { id: 'boardroom', label: 'Boardroom', icon: 'chat', group: 0 },
  { id: 'agents', label: 'Agents', icon: 'agents', group: 1 },
  { id: 'automations', label: 'Automations', icon: 'workflows', group: 1 },
  { id: 'connections', label: 'Connections', icon: 'connections', group: 1 },
  { id: 'brain', label: 'Brain', icon: 'brain', group: 2 },
  { id: 'attention', label: 'Attention', icon: 'clock', group: 2 },
  { id: 'objectives', label: 'Objectives', icon: 'objectives', group: 2 },
  { id: 'decisions', label: 'Decisions', icon: 'decisions', group: 2 },
  { id: 'providers', label: 'Providers', icon: 'bolt', group: 3 },
  { id: 'settings', label: 'Settings', icon: 'settings', group: 3 }
]

export const App = (): ReactNode => {
  const { state, apply } = useStore()
  const [view, setView] = useState<View>('today')
  const [activeId, setActiveId] = useState<string | null>(state.conversations[0]?.id ?? null)

  const active = state.conversations.find((entry) => entry.id === activeId) ?? null

  // The menu bar and the global hotkey drive the window from the main process.
  useEffect(
    () =>
      api.onNavigate((next) => {
        if (NAV.some((item) => item.id === next)) setView(next as View)
      }),
    []
  )

  // Chat always needs somewhere to talk. On first visit — or after the active
  // thread is deleted — open a fresh one.
  useEffect(() => {
    if (view !== 'chat' || active) return
    void (async () => {
      const conversation = await api.createConversation(state.agents[0]?.id ?? 'chief')
      apply(await api.getState())
      setActiveId(conversation.id)
    })()
  }, [view, active, apply, state.agents])

  const startConversation = async (): Promise<void> => {
    const conversation = await api.createConversation(active?.agentId ?? state.agents[0]?.id ?? 'chief')
    apply(await api.getState())
    setActiveId(conversation.id)
    setView('chat')
  }

  const liveRuns = state.runs.filter(
    (run) => run.status === 'running' || run.status === 'awaiting_approval'
  ).length

  const counts: Partial<Record<View, number>> = {
    today: state.tasks.filter((task) => !task.done).length,
    agents: liveRuns,
    objectives: state.objectives.filter((objective) => objective.status === 'active').length,
    decisions: state.decisions.filter((decision) => decision.status === 'open').length,
    connections: state.connections.filter((entry) => entry.status === 'connected').length,
    brain: state.brain.length
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="wordmark">
          <h1>Grove</h1>
        </div>

        <nav className="nav">
          {NAV.map((item, index) => (
            <div key={item.id}>
              {index > 0 && NAV[index - 1]!.group !== item.group ? (
                <div className="nav-gap" />
              ) : null}
              <button
                className="nav-item"
                style={{ width: '100%' }}
                aria-current={view === item.id}
                onClick={() => setView(item.id)}
              >
                <Icon name={item.icon} size={16} />
                <span className="grow">{item.label}</span>
                {counts[item.id] ? <span className="count">{counts[item.id]}</span> : null}
              </button>
            </div>
          ))}
        </nav>

        <div className="rail-heading">
          <span>Threads</span>
          <button
            className="icon-btn"
            onClick={() => void startConversation()}
            aria-label="New conversation"
          >
            <Icon name="plus" size={14} />
          </button>
        </div>

        <div className="rail-list">
          {state.conversations.length === 0 ? (
            <p className="muted" style={{ padding: '4px 9px' }}>
              None yet.
            </p>
          ) : (
            state.conversations.map((conversation) => (
              <div
                className="rail-row"
                key={conversation.id}
                aria-current={view === 'chat' && conversation.id === activeId}
              >
                <button
                  className="label"
                  onClick={() => {
                    setActiveId(conversation.id)
                    setView('chat')
                  }}
                >
                  {conversation.title}
                </button>
                <button
                  className="icon-btn danger"
                  aria-label="Delete conversation"
                  onClick={async () => {
                    const next = await api.deleteConversation(conversation.id)
                    apply(next)
                    if (activeId === conversation.id) {
                      setActiveId(next.conversations[0]?.id ?? null)
                    }
                  }}
                >
                  <Icon name="close" size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="pane">
        {view === 'today' ? <Today /> : null}
        {view === 'boardroom' ? <Boardroom /> : null}
        {view === 'agents' ? <Agents /> : null}
        {view === 'automations' ? <Automations /> : null}
        {view === 'connections' ? <Connections /> : null}
        {view === 'brain' ? <Brain /> : null}
        {view === 'attention' ? <Attention /> : null}
        {view === 'objectives' ? <Objectives /> : null}
        {view === 'decisions' ? <Decisions /> : null}
        {view === 'providers' ? <Providers /> : null}
        {view === 'settings' ? <Settings /> : null}
        {view === 'chat' ? (
          active ? (
            <>
              <div className="topbar">
                <h2>{active.title}</h2>
                <div className="spacer" />
                <button className="btn ghost" onClick={() => void startConversation()}>
                  <Icon name="plus" size={14} />
                  New
                </button>
              </div>
              <Chat conversation={active} key={active.id} />
            </>
          ) : (
            <div className="topbar">
              <h2>Chat</h2>
            </div>
          )
        ) : null}
      </main>
    </div>
  )
}
