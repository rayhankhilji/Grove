import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Agent, Conversation, Message, ToolCall } from '@shared/types'
import { MODELS } from '@shared/models'
import { CONNECTORS } from '@shared/connectors'
import { api } from '../lib/api'
import { useStore } from '../lib/state'
import { Icon } from '../components/Icon'
import { Avatar, Empty, Popover, Prose } from '../components/ui'

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

          <div className="composer-bar">
            <div className="pop-wrap">
              <button className="chip" onClick={() => setAgentMenu((v) => !v)}>
                <Icon name={(agent?.glyph ?? 'council') as never} size={13} />
                {agent?.name ?? 'Agent'}
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

            <div className="pop-wrap">
              <button className="chip" onClick={() => setModelMenu((v) => !v)}>
                <Icon name="sparkle" size={13} />
                {MODELS.find((entry) => entry.id === agent?.model)?.label ?? 'Model'}
              </button>
              <Popover open={modelMenu} onClose={() => setModelMenu(false)}>
                <div className="pop-label">Model</div>
                {MODELS.map((model) => (
                  <button
                    key={model.id}
                    className="pop-item"
                    aria-selected={model.id === agent?.model}
                    onClick={async () => {
                      if (agent) apply(await api.saveAgent({ id: agent.id, model: model.id }))
                      setModelMenu(false)
                    }}
                  >
                    <span className="grow">
                      {model.label}
                      <span className="meta">{model.note}</span>
                    </span>
                    {model.id === agent?.model ? (
                      <span className="check">
                        <Icon name="check" size={14} />
                      </span>
                    ) : null}
                  </button>
                ))}
              </Popover>
            </div>

            <span className="muted" style={{ fontSize: 11 }}>
              {agent ? `${agent.toolIds.length} tools` : ''}
              {connectedCount > 0 ? ` · ${connectedCount} connected` : ''}
            </span>

            <div className="grow" />

            <button
              className="send"
              onClick={() => void submit()}
              disabled={streaming || !draft.trim()}
              aria-label="Send"
            >
              <Icon name="send" size={15} strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
