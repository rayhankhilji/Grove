import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Agent, Conversation, Message, ToolCall } from '@shared/types'
import { MODELS } from '@shared/models'
import { CONNECTORS, grantCovers } from '@shared/connectors'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { providerOfModel } from '@shared/providers'
import { Icon } from '../components/Icon'
import { BrandMark } from '../components/Brand'
import { ModelPicker } from '../components/ModelPicker'
import { Avatar, Empty, Popover, Prose } from '../components/ui'

const EFFORTS = [
  { id: 'low' as const, label: 'Low', note: 'Fast answers, shallow thinking.' },
  { id: 'medium' as const, label: 'Medium', note: 'The balanced default.' },
  { id: 'high' as const, label: 'High', note: 'Thinks longer before answering.' }
]

const ACCESS = [
  {
    id: 'supervised' as const,
    label: 'Ask first',
    note: 'Anything that leaves this Mac waits for your approval.'
  },
  {
    id: 'autonomous' as const,
    label: 'Full access',
    note: 'Sends, posts and files without stopping to ask.'
  }
]

/** A padlock that opens when the agent is allowed to act unsupervised. */
const Lock = ({ open }: { open: boolean }): ReactNode => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    {open ? <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 6.8-1.2" /> : <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />}
  </svg>
)

const LABELS: Record<string, string> = {
  review: 'Reviewed the workspace',
  set_objective: 'Set an objective',
  update_objective: 'Updated an objective',
  add_key_result: 'Added a key result',
  record_progress: 'Recorded progress',
  add_task: 'Captured a task',
  complete_task: 'Closed a task',
  frame_decision: 'Framed a decision',
  resolve_decision: 'Resolved a decision',
  remember: 'Committed to memory',
  update_profile: 'Updated the profile',
  handoff: 'Handed off to a teammate'
}

const describe = (call: ToolCall): string => {
  if (LABELS[call.name]) return LABELS[call.name]!
  const [providerId, actionId] = call.name.split('.')
  const connector = CONNECTORS.find((entry) => entry.id === providerId)
  const action = connector?.actions.find((entry) => entry.id === actionId)
  return action ? `${connector!.name} · ${action.label}` : call.name
}

/** The activity trail — collapsed by default, the way research UIs show steps. */
const Steps = ({ calls, live }: { calls: ToolCall[]; live: boolean }): ReactNode => {
  const [open, setOpen] = useState(false)
  if (calls.length === 0) return null

  return (
    <div className="steps">
      <button className="steps-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name={live ? 'sparkle' : 'tool'} size={14} />
        <span>
          {live ? 'Working' : 'Used'} {calls.length} {calls.length === 1 ? 'action' : 'actions'}
        </span>
        <Icon name="chevron" size={13} />
        <span className="chev" />
      </button>
      {open ? (
        <div className="steps-list">
          {calls.map((call, index) => (
            <div className="step" key={`${call.id}-${index}`} data-error={call.isError}>
              <span className="glyph">
                <Icon name={call.isError ? 'alert' : 'check'} size={13} />
              </span>
              <span>
                <span className="step-label">{describe(call)}</span>
                <div className="step-detail">{call.result.slice(0, 400)}</div>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const AnswerHead = ({ agent, model }: { agent: Agent | undefined; model: string }): ReactNode => (
  <div className="answer-head">
    <Avatar glyph={agent?.glyph ?? 'chat'} tint={agent?.tint ?? '#2f5d43'} size={22} />
    <span className="name">{agent?.name ?? 'Grove'}</span>
    <span className="model">{MODELS.find((entry) => entry.id === model)?.label ?? model}</span>
  </div>
)

const Answer = ({
  message,
  agent,
  showThinking
}: {
  message: Message
  agent: Agent | undefined
  showThinking: boolean
}): ReactNode => {
  const [copied, setCopied] = useState(false)

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(message.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="turn-agent">
      <AnswerHead agent={agent} model={message.model} />
      <Steps calls={message.toolCalls} live={false} />
      {showThinking && message.thinking ? (
        <div className="thinking-box">{message.thinking}</div>
      ) : null}
      <Prose markdown={message.text} />
      <div className="answer-actions">
        <button className="icon-btn" onClick={() => void copy()} aria-label="Copy answer">
          <Icon name={copied ? 'check' : 'copy'} size={15} />
        </button>
      </div>
    </div>
  )
}

export const Chat = ({ conversation }: { conversation: Conversation }): ReactNode => {
  const { state, apply, keyStatus } = useStore()
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState('')
  const [calls, setCalls] = useState<ToolCall[]>([])
  const [error, setError] = useState<string | null>(null)
  const [approval, setApproval] = useState<{ key: string; summary: string; toolName: string } | null>(null)
  const [agentMenu, setAgentMenu] = useState(false)
  const [modelMenu, setModelMenu] = useState(false)
  const [effortMenu, setEffortMenu] = useState(false)
  const [accessMenu, setAccessMenu] = useState(false)
  const [readyProviders, setReadyProviders] = useState<string[]>([])

  const scroller = useRef<HTMLDivElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const pinned = useRef(true)

  const agent = useMemo(
    () => state.agents.find((entry) => entry.id === conversation.agentId),
    [state.agents, conversation.agentId]
  )

  useEffect(
    () =>
      api.onAgentEvent((event) => {
        switch (event.type) {
          case 'chat.start':
            setText('')
            setThinking('')
            setCalls([])
            setError(null)
            break
          case 'chat.text':
            setText((current) => current + event.text)
            break
          case 'chat.thinking':
            setThinking((current) => current + event.text)
            break
          case 'chat.tool':
            setCalls((current) => [...current, event.call])
            break
          case 'chat.approval':
            setApproval(event.pending)
            break
          case 'state':
            apply(event.state)
            break
          case 'chat.error':
            setError(event.message)
            break
          case 'chat.done':
            apply(event.state)
            setStreaming(false)
            setApproval(null)
            setText('')
            setThinking('')
            setCalls([])
            break
        }
      }),
    [apply]
  )

  // Follow the stream only while the reader is already at the bottom, so
  // scrolling back to reread something is never yanked away.
  useLayoutEffect(() => {
    const node = scroller.current
    if (node && pinned.current) node.scrollTop = node.scrollHeight
  }, [conversation.messages.length, text, calls.length, approval])

  const onScroll = (): void => {
    const node = scroller.current
    if (!node) return
    pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 90
  }

  const grow = (): void => {
    const node = textarea.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`
  }

  const submit = async (): Promise<void> => {
    const message = draft.trim()
    if (!message || streaming) return
    setDraft('')
    setStreaming(true)
    pinned.current = true
    requestAnimationFrame(grow)
    await api.send(conversation.id, message)
  }

  const connectedCount = state.connections.filter((entry) => entry.status === 'connected').length
  const activeModel = agent?.model ?? state.settings.model
  const modelProvider = providerOfModel(activeModel)

  // The picker marks models whose provider has no credential yet, so choosing
  // one that cannot run is a visible decision rather than a silent failure.
  useEffect(() => {
    void api.configuredProviders().then(setReadyProviders)
  }, [])

  // Wildcards mean the stored grant count understates the real reach, so count
  // what the agent could actually call instead.
  const toolCount = useMemo(() => {
    if (!agent) return 0
    const actions = CONNECTORS.flatMap((connector) =>
      connector.actions.map((action) => `${connector.id}.${action.id}`)
    )
    const viaGrants = actions.filter((toolId) =>
      agent.toolIds.some((grant) => grantCovers(grant, toolId))
    ).length
    return agent.toolIds.filter((grant) => !grant.includes('*')).length + viaGrants
  }, [agent])

  return (
    <>
      <div className="scroll" ref={scroller} onScroll={onScroll}>
        <div className="thread">
          {conversation.messages.length === 0 && !streaming ? (
            <Empty icon="chat" title={`${agent?.name ?? 'Your CEO'} is in.`}>
              {agent?.role ?? 'Tell it what you are working on, what is stuck, or what you are deciding.'}
              {connectedCount === 0
                ? ' Connect your tools to let it act on your behalf, not just advise.'
                : ''}
            </Empty>
          ) : null}

          {conversation.messages.map((message) =>
            message.role === 'user' ? (
              <div className="turn-user" key={message.id}>
                <div className="bubble">{message.text}</div>
              </div>
            ) : (
              <Answer
                key={message.id}
                message={message}
                agent={state.agents.find((entry) => entry.id === message.agentId) ?? agent}
                showThinking={state.settings.showThinking}
              />
            )
          )}

          {streaming ? (
            <div className="turn-agent">
              <AnswerHead agent={agent} model={agent?.model ?? state.settings.model} />
              <Steps calls={calls} live />
              {state.settings.showThinking && thinking && !text ? (
                <div className="thinking-box">{thinking}</div>
              ) : null}
              {text ? (
                <Prose markdown={text} />
              ) : (
                <div className="prose">
                  <span className="caret" />
                </div>
              )}
            </div>
          ) : null}

          {approval ? (
            <div className="card" style={{ borderColor: 'var(--accent-line)' }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <Icon name="alert" size={17} />
                <div className="grow">
                  <strong style={{ fontSize: 13 }}>Approve {approval.toolName}?</strong>
                  <p className="muted" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
                    {approval.summary}
                  </p>
                </div>
              </div>
              <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
                <button
                  className="btn"
                  onClick={() => void api.settleApproval(approval.key, false)}
                >
                  Decline
                </button>
                <button
                  className="btn primary"
                  onClick={() => void api.settleApproval(approval.key, true)}
                >
                  Approve
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="composer">
        {error ? (
          <div className="notice" style={{ maxWidth: 760, margin: '0 auto 8px' }}>
            {error}
          </div>
        ) : null}
        {!keyStatus.configured ? (
          <div className="notice info" style={{ maxWidth: 760, margin: '0 auto 8px' }}>
            Add your Anthropic API key in Settings to start.
          </div>
        ) : null}

        <div className="composer-inner">
          <textarea
            ref={textarea}
            rows={1}
            value={draft}
            placeholder={`Ask ${agent?.name ?? 'Grove'}…`}
            disabled={streaming}
            onChange={(event) => {
              setDraft(event.target.value)
              grow()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void submit()
              }
            }}
          />

          {/*
            One row of segments, divided by hairlines: who is answering, on what
            model, at what reasoning effort, with how much freedom to act. Every
            control that changes the next reply lives here and nowhere else.
          */}
          <div className="composer-bar">
            <div className="pop-wrap">
              <button className="seg-btn" data-on={agentMenu} onClick={() => setAgentMenu((v) => !v)}>
                <Avatar glyph={agent?.glyph ?? 'chat'} tint={agent?.tint ?? '#2563eb'} size={18} />
                {agent?.name ?? 'Agent'}
                <Icon name="chevron" size={13} />
              </button>
              <Popover open={agentMenu} onClose={() => setAgentMenu(false)}>
                <div className="pop-label">Answering as</div>
                {state.agents.map((candidate) => (
                  <button
                    key={candidate.id}
                    className="pop-item"
                    aria-selected={candidate.id === conversation.agentId}
                    onClick={async () => {
                      apply(await api.setConversationAgent(conversation.id, candidate.id))
                      setAgentMenu(false)
                    }}
                  >
                    <Avatar glyph={candidate.glyph} tint={candidate.tint} size={22} />
                    <span className="grow">
                      {candidate.name}
                      <span className="meta">{candidate.role}</span>
                    </span>
                    {candidate.id === conversation.agentId ? (
                      <span className="check">
                        <Icon name="check" size={14} />
                      </span>
                    ) : null}
                  </button>
                ))}
              </Popover>
            </div>

            <span className="seg-rule" />

            <div className="pop-wrap">
              <button className="seg-btn" data-on={modelMenu} onClick={() => setModelMenu((v) => !v)}>
                <BrandMark id={modelProvider.id} name={modelProvider.name} size={15} />
                {MODELS.find((entry) => entry.id === activeModel)?.label ?? 'Model'}
                <Icon name="chevron" size={13} />
              </button>
              {modelMenu ? (
                <Popover open onClose={() => setModelMenu(false)}>
                  <ModelPicker
                    value={activeModel}
                    favourites={state.settings.favouriteModels}
                    ready={readyProviders}
                    onPick={async (modelId) => {
                      if (agent) apply(await api.saveAgent({ id: agent.id, model: modelId }))
                      setModelMenu(false)
                    }}
                    onFavourite={async (modelId) => {
                      const current = state.settings.favouriteModels
                      apply(
                        await api.updateSettings({
                          favouriteModels: current.includes(modelId)
                            ? current.filter((entry) => entry !== modelId)
                            : [...current, modelId]
                        })
                      )
                    }}
                    onClose={() => setModelMenu(false)}
                  />
                </Popover>
              ) : null}
            </div>

            <span className="seg-rule" />

            <div className="pop-wrap">
              <button className="seg-btn" data-on={effortMenu} onClick={() => setEffortMenu((v) => !v)}>
                {EFFORTS.find((entry) => entry.id === (agent?.effort ?? 'high'))?.label}
                <Icon name="chevron" size={13} />
              </button>
              <Popover open={effortMenu} onClose={() => setEffortMenu(false)}>
                <div className="pop-label">Reasoning</div>
                {EFFORTS.map((entry) => (
                  <button
                    key={entry.id}
                    className="pop-item"
                    aria-selected={entry.id === agent?.effort}
                    onClick={async () => {
                      if (agent) apply(await api.saveAgent({ id: agent.id, effort: entry.id }))
                      setEffortMenu(false)
                    }}
                  >
                    <span className="tick-slot">
                      {entry.id === agent?.effort ? <Icon name="check" size={14} /> : null}
                    </span>
                    <span className="grow">
                      {entry.label}
                      <span className="meta">{entry.note}</span>
                    </span>
                  </button>
                ))}
              </Popover>
            </div>

            <span className="seg-rule" />

            <div className="pop-wrap">
              <button className="seg-btn" data-on={accessMenu} onClick={() => setAccessMenu((v) => !v)}>
                <Lock open={agent?.autonomy === 'autonomous'} />
                {agent?.autonomy === 'autonomous' ? 'Full access' : 'Ask first'}
                <Icon name="chevron" size={13} />
              </button>
              <Popover open={accessMenu} onClose={() => setAccessMenu(false)}>
                <div className="pop-label">Acting on your behalf</div>
                {ACCESS.map((entry) => (
                  <button
                    key={entry.id}
                    className="pop-item"
                    aria-selected={entry.id === agent?.autonomy}
                    onClick={async () => {
                      if (agent) apply(await api.saveAgent({ id: agent.id, autonomy: entry.id }))
                      setAccessMenu(false)
                    }}
                  >
                    <span className="tick-slot">
                      {entry.id === agent?.autonomy ? <Icon name="check" size={14} /> : null}
                    </span>
                    <span className="grow">
                      {entry.label}
                      <span className="meta">{entry.note}</span>
                    </span>
                  </button>
                ))}
              </Popover>
            </div>

            <span className="seg-rule" />

            <span className="seg-note">
              {toolCount} {toolCount === 1 ? 'tool' : 'tools'}
              {connectedCount > 0 ? ` · ${connectedCount} apps` : ''}
            </span>

            <div className="grow" />

            {streaming ? <span className="spinner" aria-label="Working" /> : null}

            <button
              className="send"
              onClick={() => void submit()}
              disabled={streaming || !draft.trim()}
              aria-label="Send"
            >
              <Icon name="send" size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
