import { BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron'
import type {
  Agent,
  AgentEvent,
  AppState,
  Conversation,
  Horizon,
  KeyStatus,
  Objective,
  Profile,
  Meeting,
  MeetingAttachment,
  Settings,
  Task,
  Workflow
} from '@shared/types'
import { chat, generateBriefing } from './chat'
import { cancelRun, onRunUpdate, settleApproval, startRun } from './agents/runtime'
import { BUILT_IN_AGENTS } from './agents/defaults'
import {
  connectProvider,
  connectWithToken,
  disconnectProvider,
  saveOAuthApp,
  syncConnections
} from './connectors/manager'
import { REDIRECT_URI } from './connectors/oauth'
import { onWorkflowUpdate, runWorkflow } from './workflows'
import { syncTray } from './native/tray'
import {
  BENCHES,
  MEETING_KINDS,
  deleteMeeting,
  endMeeting,
  interject,
  nextTurn,
  startMeeting,
  type StartConfig
} from './boardroom'
import { extractText, SUPPORTED_EXTENSIONS } from './native/files'
import { FISH_KEY_ID, listVoices, type FishVoice } from './voice/fish'
import { llmKeyId } from './llm'
import { currentFocus } from './native/context'
import { vault } from './vault'
import { id, now, store } from './store'

const broadcast = (event: AgentEvent): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('agent:event', event)
  }
}

const handle = <A extends unknown[], R>(
  channel: string,
  fn: (...args: A) => R | Promise<R>
): void => {
  ipcMain.handle(channel, async (_event, ...args) => fn(...(args as A)))
}

/** IPC handlers are process-global, so this runs exactly once at startup. */
export const registerIpc = (): void => {
  onRunUpdate((run) => broadcast({ type: 'run.update', run }))
  onWorkflowUpdate(() => broadcast({ type: 'state', state: store.get() }))

  handle<[], AppState>('state:get', () => store.get())
  handle<[], string>('oauth:redirect', () => REDIRECT_URI)

  handle<[Partial<Settings>], AppState>('settings:update', (patch) => {
    const state = store.update((draft) => {
      draft.settings = { ...draft.settings, ...patch }
    })
    nativeTheme.themeSource = state.settings.theme
    syncTray()
    return state
  })

  handle<[], string>('native:focus', () => currentFocus())

  /* ── Boardroom ─────────────────────────────────────────────────────── */

  handle<[], { kinds: typeof MEETING_KINDS; benches: typeof BENCHES }>('board:meta', () => ({
    kinds: MEETING_KINDS,
    benches: BENCHES
  }))

  handle<[StartConfig], Meeting>('board:start', (config) => startMeeting(config))

  handle<[string], AppState>('board:next', async (meetingId) => {
    await nextTurn(meetingId, broadcast)
    return store.get()
  })

  handle<[string, string], AppState>('board:say', (meetingId, text) => {
    const turn = interject(meetingId, text)
    if (turn) broadcast({ type: 'meeting.turn', meetingId, turn })
    return store.get()
  })

  handle<[string], AppState>('board:end', async (meetingId) => {
    await endMeeting(meetingId, broadcast)
    return store.get()
  })

  handle<[string], AppState>('board:delete', (meetingId) => {
    deleteMeeting(meetingId)
    return store.get()
  })

  handle<[], MeetingAttachment[]>('board:attach', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Add materials',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Documents', extensions: SUPPORTED_EXTENSIONS }]
    })
    if (result.canceled) return []
    return Promise.all(result.filePaths.map(extractText))
  })

  /* ── Provider & voice keys ─────────────────────────────────────────── */

  handle<[string, string], AppState>('provider:key', (providerId, key) => {
    // The Anthropic key predates this and keeps its dedicated slot.
    if (providerId === 'anthropic') vault.setKey(key)
    else vault.saveProvider(llmKeyId(providerId), { accessToken: key.trim() || undefined })
    return store.get()
  })

  handle<[], string[]>('provider:configured', () => {
    const ready: string[] = []
    if (vault.getKey()) ready.push('anthropic')
    for (const provider of ['deepseek', 'groq', 'openrouter', 'google', 'openai', 'ollama']) {
      if (vault.provider(llmKeyId(provider)).accessToken) ready.push(provider)
    }
    return ready
  })

  handle<[string], boolean>('voice:key', (key) => {
    vault.saveProvider(FISH_KEY_ID, { accessToken: key.trim() || undefined })
    return Boolean(key.trim())
  })

  handle<[], boolean>('voice:has', () => Boolean(vault.provider(FISH_KEY_ID).accessToken))
  handle<[string], FishVoice[]>('voice:list', (query) => listVoices(query))

  handle<[Partial<Profile>], AppState>('profile:update', (patch) =>
    store.update((draft) => {
      draft.profile = { ...draft.profile, ...patch }
    })
  )

  /* ── Chat ──────────────────────────────────────────────────────────── */

  handle<[string], Conversation>('conversation:create', (agentId) => {
    const state = store.get()
    const conversation: Conversation = {
      id: id(),
      title: 'New conversation',
      messages: [],
      agentId: agentId || state.agents[0]?.id || 'chief',
      createdAt: now(),
      updatedAt: now()
    }
    store.update((draft) => {
      draft.conversations.unshift(conversation)
    })
    return conversation
  })

  handle<[string], AppState>('conversation:delete', (conversationId) =>
    store.update((draft) => {
      draft.conversations = draft.conversations.filter((entry) => entry.id !== conversationId)
    })
  )

  handle<[string, string], AppState>('conversation:agent', (conversationId, agentId) =>
    store.update((draft) => {
      const conversation = draft.conversations.find((entry) => entry.id === conversationId)
      if (conversation) conversation.agentId = agentId
    })
  )

  handle<[string, string], void>('chat:send', async (conversationId, text) => {
    await chat(conversationId, text, broadcast)
  })

  handle<[string, boolean], void>('approval:settle', (key, approved) =>
    settleApproval(key, approved)
  )

  handle<[], string>('briefing:generate', () => generateBriefing())

  /* ── Agents & runs ─────────────────────────────────────────────────── */

  handle<[Partial<Agent>], AppState>('agent:save', (patch) =>
    store.update((draft) => {
      if (patch.id) {
        const index = draft.agents.findIndex((entry) => entry.id === patch.id)
        const existing = draft.agents[index]
        if (existing) {
          draft.agents[index] = { ...existing, ...patch, updatedAt: now() }
          return
        }
      }
      const template = BUILT_IN_AGENTS()[0]!
      draft.agents.push({
        ...template,
        ...patch,
        id: patch.id ?? id(),
        builtIn: false,
        createdAt: now(),
        updatedAt: now()
      })
    })
  )

  handle<[string], AppState>('agent:delete', (agentId) =>
    store.update((draft) => {
      draft.agents = draft.agents.filter((entry) => entry.id !== agentId)
      // Never leave a dangling handoff target behind.
      for (const agent of draft.agents) {
        agent.handoffIds = agent.handoffIds.filter((entry) => entry !== agentId)
      }
    })
  )

  handle<[string, string], AppState>('agent:launch', async (agentId, input) => {
    const agent = store.get().agents.find((entry) => entry.id === agentId)
    if (!agent) return store.get()
    await startRun({ agent, input, trigger: 'manual', triggeredBy: 'You' })
    return store.get()
  })

  handle<[string], AppState>('run:cancel', (runId) => {
    cancelRun(runId)
    return store.get()
  })

  handle<[], AppState>('run:clear', () =>
    store.update((draft) => {
      draft.runs = draft.runs.filter(
        (run) => run.status === 'running' || run.status === 'awaiting_approval'
      )
    })
  )

  /* ── Workflows ─────────────────────────────────────────────────────── */

  handle<[Partial<Workflow>], AppState>('workflow:save', (patch) =>
    store.update((draft) => {
      if (patch.id) {
        const index = draft.workflows.findIndex((entry) => entry.id === patch.id)
        const existing = draft.workflows[index]
        if (existing) {
          draft.workflows[index] = { ...existing, ...patch }
          return
        }
      }
      draft.workflows.push({
        id: patch.id ?? id(),
        name: patch.name ?? 'Untitled automation',
        description: patch.description ?? '',
        trigger: patch.trigger ?? 'manual',
        schedule: patch.schedule ?? { hour: 8, minute: 0, days: [1, 2, 3, 4, 5] },
        steps: patch.steps ?? [],
        enabled: patch.enabled ?? true,
        lastRunAt: null,
        createdAt: now()
      })
    })
  )

  handle<[string], AppState>('workflow:delete', (workflowId) =>
    store.update((draft) => {
      draft.workflows = draft.workflows.filter((entry) => entry.id !== workflowId)
    })
  )

  handle<[string], AppState>('workflow:run', async (workflowId) => {
    await runWorkflow(workflowId, 'manual')
    return store.get()
  })

  /* ── Connections ───────────────────────────────────────────────────── */

  handle<[], AppState>('connections:sync', () => syncConnections())
  handle<[string, string, string], AppState>('connections:app', (providerId, clientId, secret) =>
    saveOAuthApp(providerId, clientId, secret)
  )
  handle<[string], AppState>('connections:connect', (providerId) => connectProvider(providerId))
  handle<[string, string], AppState>('connections:token', (providerId, token) =>
    connectWithToken(providerId, token)
  )
  handle<[string], AppState>('connections:disconnect', (providerId) =>
    disconnectProvider(providerId)
  )

  /* ── Workspace ─────────────────────────────────────────────────────── */

  handle<[string, Horizon, string | null], AppState>('task:create', (title, horizon, objectiveId) =>
    store.update((draft) => {
      const task: Task = {
        id: id(),
        title,
        objectiveId,
        horizon,
        done: false,
        createdBy: null,
        createdAt: now(),
        completedAt: null
      }
      draft.tasks.push(task)
    })
  )

  handle<[string], AppState>('task:toggle', (taskId) =>
    store.update((draft) => {
      const task = draft.tasks.find((entry) => entry.id === taskId)
      if (!task) return
      task.done = !task.done
      task.completedAt = task.done ? now() : null
    })
  )

  handle<[string], AppState>('task:delete', (taskId) =>
    store.update((draft) => {
      draft.tasks = draft.tasks.filter((entry) => entry.id !== taskId)
    })
  )

  handle<[Partial<Objective> & { id: string }], AppState>('objective:update', (patch) =>
    store.update((draft) => {
      const index = draft.objectives.findIndex((entry) => entry.id === patch.id)
      const existing = draft.objectives[index]
      if (existing) draft.objectives[index] = { ...existing, ...patch, updatedAt: now() }
    })
  )

  handle<[string], AppState>('objective:delete', (objectiveId) =>
    store.update((draft) => {
      draft.objectives = draft.objectives.filter((entry) => entry.id !== objectiveId)
      draft.tasks = draft.tasks.map((task) =>
        task.objectiveId === objectiveId ? { ...task, objectiveId: null } : task
      )
    })
  )

  handle<[string, string, number], AppState>('keyresult:update', (objectiveId, krId, current) =>
    store.update((draft) => {
      const objective = draft.objectives.find((entry) => entry.id === objectiveId)
      const kr = objective?.keyResults.find((entry) => entry.id === krId)
      if (!objective || !kr) return
      kr.current = current
      objective.updatedAt = now()
    })
  )

  handle<[string, string, string], AppState>('decision:resolve', (decisionId, chosen, rationale) =>
    store.update((draft) => {
      const decision = draft.decisions.find((entry) => entry.id === decisionId)
      if (!decision) return
      decision.status = 'decided'
      decision.chosen = chosen
      decision.rationale = rationale || null
      decision.decidedAt = now()
    })
  )

  handle<[string], AppState>('decision:delete', (decisionId) =>
    store.update((draft) => {
      draft.decisions = draft.decisions.filter((entry) => entry.id !== decisionId)
    })
  )

  handle<[string], AppState>('memory:delete', (memoryId) =>
    store.update((draft) => {
      draft.memories = draft.memories.filter((entry) => entry.id !== memoryId)
    })
  )

  /* ── Key & shell ───────────────────────────────────────────────────── */

  handle<[], KeyStatus>('key:status', () => vault.keyStatus())
  handle<[string], KeyStatus>('key:set', (key) => vault.setKey(key))
  handle<[], KeyStatus>('key:clear', () => vault.clearKey())

  handle<[string], void>('shell:open', async (url) => {
    if (/^https:\/\//.test(url)) await shell.openExternal(url)
  })
}
