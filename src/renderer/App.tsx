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
import { Home } from './views/Home'

type View =
  | 'home'
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

interface NavItem {
  id: View
  label: string
  icon: IconName
}

/**
 * The sidebar, in three named groups plus a pinned footer.
 *
 * Twelve destinations in one undifferentiated column is a list you have to
 * read. Grouped and labelled, it becomes a place you navigate: what you do
 * today, what runs for you, and what the whole thing knows.
 */
const GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [
      { id: 'home', label: 'Home', icon: 'today' },
      { id: 'chat', label: 'Chat', icon: 'chat' },
      { id: 'boardroom', label: 'Boardroom', icon: 'boardroom' }
    ]
  },
  {
    label: 'Runs for you',
    items: [
      { id: 'agents', label: 'Agents', icon: 'agents' },
      { id: 'automations', label: 'Automations', icon: 'automations' },
      { id: 'connections', label: 'Connections', icon: 'connections' }
    ]
  },
  {
    label: 'What it knows',
    items: [
      { id: 'brain', label: 'Brain', icon: 'brain' },
      { id: 'objectives', label: 'Objectives', icon: 'objectives' },
      { id: 'decisions', label: 'Decisions', icon: 'decisions' },
      { id: 'attention', label: 'Attention', icon: 'attention' }
    ]
  }
]

/** Pinned to the bottom: setup, not daily work. */
const FOOTER: NavItem[] = [
  { id: 'providers', label: 'Providers', icon: 'providers' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
]

const NAV: NavItem[] = [...GROUPS.flatMap((group) => group.items), ...FOOTER]

export const App = (): ReactNode => {
  const { state, apply } = useStore()
  const [view, setView] = useState<View>('home')
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
    home: state.tasks.filter((task) => !task.done).length,
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

        <div className="side-scroll">
          {GROUPS.map((group) => (
            <nav className="nav" key={group.label ?? 'primary'}>
              {group.label ? <div className="nav-label">{group.label}</div> : null}
              {group.items.map((item) => (
                <button
                  className="nav-item"
                  key={item.id}
                  aria-current={view === item.id}
                  onClick={() => setView(item.id)}
                >
                  <Icon name={item.icon} size={16} />
                  <span className="grow">{item.label}</span>
                  {counts[item.id] ? <span className="count">{counts[item.id]}</span> : null}
                </button>
              ))}
            </nav>
          ))}

          {/*
            Threads belong to Chat, so they only appear once you are in it.
            Carrying an ever-growing list under every other view is most of
            what made this rail feel cluttered.
          */}
          {view === 'chat' ? (
            <div className="nav">
              <div className="nav-label">
                <span className="grow">Threads</span>
                <button
                  className="icon-btn"
                  onClick={() => void startConversation()}
                  aria-label="New conversation"
                >
                  <Icon name="plus" size={13} />
                </button>
              </div>

              {state.conversations.length === 0 ? (
                <p className="muted nav-none">None yet.</p>
              ) : (
                state.conversations.map((conversation) => (
                  <div
                    className="rail-row"
                    key={conversation.id}
                    aria-current={conversation.id === activeId}
                  >
                    <button className="label" onClick={() => setActiveId(conversation.id)}>
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
          ) : null}
        </div>

        <nav className="nav side-foot">
          {FOOTER.map((item) => (
            <button
              className="nav-item"
              key={item.id}
              aria-current={view === item.id}
              onClick={() => setView(item.id)}
            >
              <Icon name={item.icon} size={16} />
              <span className="grow">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="pane">
        {view === 'home' ? (
          <Home onGo={(next) => setView(next as View)} onStartChat={() => void startConversation()} />
        ) : null}
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
