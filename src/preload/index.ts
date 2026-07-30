import { contextBridge, ipcRenderer } from 'electron'
import type {
  Agent,
  AgentEvent,
  AppState,
  Conversation,
  Horizon,
  KeyStatus,
  Objective,
  BrainEntry,
  Meeting,
  MeetingAttachment,
  Profile,
  Settings,
  Workflow
} from '@shared/types'

export interface FishVoice {
  id: string
  title: string
  author: string
  languages: string[]
  visibility: string
}

export interface BoardMeta {
  kinds: { id: string; label: string }[]
  benches: { id: string; label: string; kind: string; personaIds: string[] }[]
}

/**
 * The entire surface the renderer may touch. Node stays in the main process;
 * the window only ever sees these functions.
 */
const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('state:get'),
  redirectUri: (): Promise<string> => ipcRenderer.invoke('oauth:redirect'),
  updateSettings: (patch: Partial<Settings>): Promise<AppState> =>
    ipcRenderer.invoke('settings:update', patch),
  updateProfile: (patch: Partial<Profile>): Promise<AppState> =>
    ipcRenderer.invoke('profile:update', patch),

  // Chat
  createConversation: (agentId: string): Promise<Conversation> =>
    ipcRenderer.invoke('conversation:create', agentId),
  deleteConversation: (id: string): Promise<AppState> =>
    ipcRenderer.invoke('conversation:delete', id),
  setConversationAgent: (id: string, agentId: string): Promise<AppState> =>
    ipcRenderer.invoke('conversation:agent', id, agentId),
  send: (conversationId: string, text: string): Promise<void> =>
    ipcRenderer.invoke('chat:send', conversationId, text),
  settleApproval: (key: string, approved: boolean): Promise<void> =>
    ipcRenderer.invoke('approval:settle', key, approved),
  generateBriefing: (): Promise<string> => ipcRenderer.invoke('briefing:generate'),

  // Agents & runs
  saveAgent: (patch: Partial<Agent>): Promise<AppState> => ipcRenderer.invoke('agent:save', patch),
  deleteAgent: (id: string): Promise<AppState> => ipcRenderer.invoke('agent:delete', id),
  launchAgent: (id: string, input: string): Promise<AppState> =>
    ipcRenderer.invoke('agent:launch', id, input),
  cancelRun: (id: string): Promise<AppState> => ipcRenderer.invoke('run:cancel', id),
  clearRuns: (): Promise<AppState> => ipcRenderer.invoke('run:clear'),

  // Workflows
  saveWorkflow: (patch: Partial<Workflow>): Promise<AppState> =>
    ipcRenderer.invoke('workflow:save', patch),
  deleteWorkflow: (id: string): Promise<AppState> => ipcRenderer.invoke('workflow:delete', id),
  runWorkflow: (id: string): Promise<AppState> => ipcRenderer.invoke('workflow:run', id),

  // Boardroom
  boardMeta: (): Promise<BoardMeta> => ipcRenderer.invoke('board:meta'),
  startMeeting: (config: {
    title: string
    kind: string
    brief: string
    personaIds: string[]
    attachments: MeetingAttachment[]
  }): Promise<Meeting> => ipcRenderer.invoke('board:start', config),
  nextTurn: (meetingId: string): Promise<AppState> => ipcRenderer.invoke('board:next', meetingId),
  sayInMeeting: (meetingId: string, text: string): Promise<AppState> =>
    ipcRenderer.invoke('board:say', meetingId, text),
  endMeeting: (meetingId: string): Promise<AppState> => ipcRenderer.invoke('board:end', meetingId),
  deleteMeeting: (meetingId: string): Promise<AppState> =>
    ipcRenderer.invoke('board:delete', meetingId),
  attachMaterials: (): Promise<MeetingAttachment[]> => ipcRenderer.invoke('board:attach'),

  // Company brain
  addBrain: (title: string, body: string, tags: string[]): Promise<AppState> =>
    ipcRenderer.invoke('brain:add', title, body, tags),
  updateBrain: (id: string, patch: Partial<BrainEntry>): Promise<AppState> =>
    ipcRenderer.invoke('brain:update', id, patch),
  deleteBrain: (id: string): Promise<AppState> => ipcRenderer.invoke('brain:delete', id),
  importBrain: (): Promise<AppState> => ipcRenderer.invoke('brain:import'),

  // Providers & voice
  setProviderKey: (providerId: string, key: string): Promise<AppState> =>
    ipcRenderer.invoke('provider:key', providerId, key),
  configuredProviders: (): Promise<string[]> => ipcRenderer.invoke('provider:configured'),
  setVoiceKey: (key: string): Promise<boolean> => ipcRenderer.invoke('voice:key', key),
  hasVoiceKey: (): Promise<boolean> => ipcRenderer.invoke('voice:has'),
  listVoices: (query: string): Promise<FishVoice[]> => ipcRenderer.invoke('voice:list', query),

  // Connections
  syncConnections: (): Promise<AppState> => ipcRenderer.invoke('connections:sync'),
  saveOAuthApp: (providerId: string, clientId: string, secret: string): Promise<AppState> =>
    ipcRenderer.invoke('connections:app', providerId, clientId, secret),
  connect: (providerId: string): Promise<AppState> =>
    ipcRenderer.invoke('connections:connect', providerId),
  connectWithToken: (providerId: string, token: string): Promise<AppState> =>
    ipcRenderer.invoke('connections:token', providerId, token),
  disconnect: (providerId: string): Promise<AppState> =>
    ipcRenderer.invoke('connections:disconnect', providerId),

  // Workspace
  createTask: (title: string, horizon: Horizon, objectiveId: string | null): Promise<AppState> =>
    ipcRenderer.invoke('task:create', title, horizon, objectiveId),
  toggleTask: (id: string): Promise<AppState> => ipcRenderer.invoke('task:toggle', id),
  deleteTask: (id: string): Promise<AppState> => ipcRenderer.invoke('task:delete', id),
  updateObjective: (patch: Partial<Objective> & { id: string }): Promise<AppState> =>
    ipcRenderer.invoke('objective:update', patch),
  deleteObjective: (id: string): Promise<AppState> => ipcRenderer.invoke('objective:delete', id),
  updateKeyResult: (objectiveId: string, keyResultId: string, current: number): Promise<AppState> =>
    ipcRenderer.invoke('keyresult:update', objectiveId, keyResultId, current),
  resolveDecision: (id: string, chosen: string, rationale: string): Promise<AppState> =>
    ipcRenderer.invoke('decision:resolve', id, chosen, rationale),
  deleteDecision: (id: string): Promise<AppState> => ipcRenderer.invoke('decision:delete', id),
  deleteMemory: (id: string): Promise<AppState> => ipcRenderer.invoke('memory:delete', id),

  // Key & shell
  keyStatus: (): Promise<KeyStatus> => ipcRenderer.invoke('key:status'),
  setKey: (key: string): Promise<KeyStatus> => ipcRenderer.invoke('key:set', key),
  clearKey: (): Promise<KeyStatus> => ipcRenderer.invoke('key:clear'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open', url),
  currentFocus: (): Promise<string> => ipcRenderer.invoke('native:focus'),

  /** The menu bar and global hotkey ask the window to change view. */
  onNavigate: (listener: (view: string) => void): (() => void) => {
    const handler = (_: unknown, view: string): void => listener(view)
    ipcRenderer.on('navigate', handler)
    return () => ipcRenderer.off('navigate', handler)
  },

  /** Subscribes to agent and run events. Returns an unsubscribe function. */
  onAgentEvent: (listener: (event: AgentEvent) => void): (() => void) => {
    const handler = (_: unknown, event: AgentEvent): void => listener(event)
    ipcRenderer.on('agent:event', handler)
    return () => ipcRenderer.off('agent:event', handler)
  }
}

export type StobsApi = typeof api

contextBridge.exposeInMainWorld('stobs', api)
