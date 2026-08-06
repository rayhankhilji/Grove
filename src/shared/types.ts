/** The Grove domain. Shared verbatim between main, preload and renderer. */

export type ID = string
export type ISO = string

/* ── Workspace ───────────────────────────────────────────────────────────── */

export type Horizon = 'now' | 'next' | 'later'
export type ObjectiveStatus = 'active' | 'paused' | 'achieved' | 'dropped'

export interface KeyResult {
  id: ID
  title: string
  /** Baseline, so progress on a non-zero starting metric stays honest. */
  start: number
  current: number
  target: number
  unit: string
}

export interface Objective {
  id: ID
  title: string
  why: string
  status: ObjectiveStatus
  horizon: Horizon
  dueDate: string | null
  keyResults: KeyResult[]
  createdAt: ISO
  updatedAt: ISO
}

export interface Task {
  id: ID
  title: string
  objectiveId: ID | null
  horizon: Horizon
  done: boolean
  /** Set when an agent created the task, so provenance is visible. */
  createdBy: ID | null
  createdAt: ISO
  completedAt: ISO | null
}

export interface DecisionOption {
  label: string
  upside: string
  risk: string
}

export interface Decision {
  id: ID
  question: string
  context: string
  options: DecisionOption[]
  recommendation: string
  status: 'open' | 'decided'
  chosen: string | null
  rationale: string | null
  createdAt: ISO
  decidedAt: ISO | null
}

export interface Memory {
  id: ID
  text: string
  tag: string
  createdAt: ISO
}

export interface Profile {
  name: string
  role: string
  venture: string
  mission: string
  operatingStyle: string
}

export interface AttentionApp {
  name: string
  seconds: number
}

export interface AttentionDay {
  date: string
  apps: AttentionApp[]
}

export interface BrainEntry {
  id: ID
  title: string
  body: string
  /** Where it came from: 'you', 'agent', or a filename. */
  source: string
  tags: string[]
  /** Pinned entries ride along in every prompt regardless of relevance. */
  pinned: boolean
  createdAt: ISO
  updatedAt: ISO
}

export interface Briefing {
  date: string
  body: string
  generatedAt: ISO
}

/* ── Agents ──────────────────────────────────────────────────────────────── */

/** Whether an agent may take write actions on its own. */
export type Autonomy = 'supervised' | 'autonomous'

export interface Agent {
  id: ID
  name: string
  /** One line describing what this agent is for. */
  role: string
  /** Icon key + accent, so each agent is recognisable at a glance. */
  glyph: string
  tint: string
  model: string
  effort: 'low' | 'medium' | 'high'
  instructions: string
  /** Tool ids this agent may call, including connector tools. */
  toolIds: string[]
  /** Agents this one is allowed to hand work to. */
  handoffIds: ID[]
  autonomy: Autonomy
  builtIn: boolean
  createdAt: ISO
  updatedAt: ISO
}

export type StepKind = 'thinking' | 'text' | 'tool' | 'handoff' | 'error' | 'approval'

export interface RunStep {
  id: ID
  kind: StepKind
  label: string
  detail: string
  tool?: { name: string; input: Record<string, unknown>; result: string; isError: boolean }
  /** Set on handoff steps — the run that was spawned. */
  spawnedRunId?: ID
  at: ISO
}

export type RunStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export interface PendingApproval {
  stepId: ID
  toolName: string
  summary: string
  input: Record<string, unknown>
}

export interface Run {
  id: ID
  agentId: ID
  agentName: string
  trigger: 'manual' | 'schedule' | 'handoff' | 'workflow' | 'chat'
  /** What set this off — a workflow name, parent agent, or "you". */
  triggeredBy: string
  input: string
  output: string
  status: RunStatus
  steps: RunStep[]
  pending: PendingApproval | null
  parentRunId: ID | null
  workflowRunId: ID | null
  tokensIn: number
  tokensOut: number
  startedAt: ISO
  endedAt: ISO | null
  error: string | null
}

/* ── Workflows ───────────────────────────────────────────────────────────── */

export type TriggerKind = 'manual' | 'schedule'

export interface Schedule {
  /** Local 24h time. */
  hour: number
  minute: number
  /** 0 = Sunday. Empty means every day. */
  days: number[]
}

export interface WorkflowStep {
  id: ID
  agentId: ID
  instruction: string
  /** Feeds the previous step's output in as context. */
  usePrevious: boolean
}

export interface Workflow {
  id: ID
  name: string
  description: string
  trigger: TriggerKind
  schedule: Schedule
  steps: WorkflowStep[]
  enabled: boolean
  lastRunAt: ISO | null
  createdAt: ISO
}

export interface WorkflowRun {
  id: ID
  workflowId: ID
  workflowName: string
  status: RunStatus
  runIds: ID[]
  startedAt: ISO
  endedAt: ISO | null
  error: string | null
}

/* ── Connections ─────────────────────────────────────────────────────────── */

export type AuthKind = 'oauth' | 'token'

export interface ConnectorAction {
  id: string
  label: string
  /** Shown in the agent tool picker. */
  description: string
  write: boolean
}

export interface ConnectorSpec {
  id: string
  name: string
  /** Grouping in the Connections view. */
  category:
    | 'Email'
    | 'Calendar'
    | 'Messaging'
    | 'Work'
    | 'Files'
    | 'Money'
    | 'Customers'
    | 'Dev'
    | 'Social'
    | 'Research'
  auth: AuthKind
  /** Human note about what the provider actually allows. */
  note: string
  /** Where to create credentials. */
  setupUrl: string
  /** OAuth only. */
  authUrl?: string
  tokenUrl?: string
  scopes?: string[]
  /** Some providers still require a client secret at the token endpoint. */
  needsSecret?: boolean
  /** Token auth only — label for the pasted credential. */
  tokenLabel?: string
  actions: ConnectorAction[]
}

export interface Connection {
  providerId: string
  status: 'connected' | 'disconnected' | 'error'
  account: string | null
  connectedAt: ISO | null
  expiresAt: ISO | null
  error: string | null
  /** True when the user has supplied a client id (OAuth providers only). */
  configured: boolean
}

/* ── Boardroom ───────────────────────────────────────────────────────────── */

export type MeetingKind =
  | 'board'
  | 'pitch'
  | 'critique'
  | 'strategy'
  | 'crisis'
  | 'hiring'
  | 'roast'

export interface MeetingAttachment {
  name: string
  /** Extracted text. Slides are flattened to text before the call starts. */
  text: string
}

export interface MeetingTurn {
  id: ID
  /** Persona id, or 'you' when the principal speaks. */
  speaker: string
  name: string
  text: string
  /** Set once Fish Audio has rendered this turn. */
  audio: string | null
  at: ISO
}

export interface Meeting {
  id: ID
  title: string
  kind: MeetingKind
  brief: string
  attachments: MeetingAttachment[]
  personaIds: string[]
  turns: MeetingTurn[]
  status: 'live' | 'ended'
  /** Model every seat runs on — cheap models keep a long call affordable. */
  model: string
  voiceEnabled: boolean
  summary: string
  startedAt: ISO
  endedAt: ISO | null
}

/* ── Chat ────────────────────────────────────────────────────────────────── */

export interface ToolCall {
  id: ID
  name: string
  input: Record<string, unknown>
  result: string
  isError: boolean
}

export interface Message {
  id: ID
  role: 'user' | 'assistant'
  text: string
  /** Reasoning summary, kept so the transcript can be reread. */
  thinking: string
  toolCalls: ToolCall[]
  /** Which model answered — shown under the response, frontier-lab style. */
  model: string
  agentId: ID | null
  createdAt: ISO
}

export interface Conversation {
  id: ID
  title: string
  messages: Message[]
  /** Agent driving this thread. */
  agentId: ID
  createdAt: ISO
  updatedAt: ISO
}

/* ── Settings & state ────────────────────────────────────────────────────── */

export interface Settings {
  model: string
  effort: 'low' | 'medium' | 'high'
  showThinking: boolean
  theme: 'dark' | 'light' | 'system'
  /** Automations only fire while this is on. */
  automationsEnabled: boolean
  /** Frontmost-app sampling for the attention ledger. Never captures pixels. */
  attentionEnabled: boolean
  /** Keep Grove in the menu bar with live run status. */
  menuBarEnabled: boolean
  /** Model used for boardroom seats — deliberately separate from the agents'. */
  boardroomModel: string
  /**
   * How each model provider is paid for: a metered API key, or a plan already
   * bought and signed in through the vendor's CLI. Absent means API key.
   */
  providerAuth: Record<string, 'api' | 'subscription'>
  /** Speak boardroom turns aloud through Fish Audio. */
  voiceEnabled: boolean
  /** Fish Audio voice id per persona, chosen by the user. */
  personaVoices: Record<string, string>
}

export interface AppState {
  profile: Profile
  objectives: Objective[]
  tasks: Task[]
  decisions: Decision[]
  memories: Memory[]
  briefings: Briefing[]
  attention: AttentionDay[]
  brain: BrainEntry[]
  meetings: Meeting[]
  conversations: Conversation[]
  agents: Agent[]
  runs: Run[]
  workflows: Workflow[]
  workflowRuns: WorkflowRun[]
  connections: Connection[]
  settings: Settings
}

/* ── Events ──────────────────────────────────────────────────────────────── */

export type AgentEvent =
  | { type: 'chat.start'; conversationId: ID; messageId: ID }
  | { type: 'chat.thinking'; text: string }
  | { type: 'chat.text'; text: string }
  | { type: 'chat.tool'; call: ToolCall }
  /** Set while a turn is blocked waiting for the user to allow a side effect. */
  | { type: 'chat.approval'; pending: { key: string; summary: string; toolName: string } | null }
  | { type: 'chat.done'; state: AppState }
  | { type: 'chat.error'; message: string }
  | { type: 'run.update'; run: Run }
  | { type: 'meeting.turn'; meetingId: ID; turn: MeetingTurn }
  | { type: 'meeting.delta'; meetingId: ID; turnId: ID; text: string }
  | { type: 'meeting.speaking'; meetingId: ID; speaker: string | null }
  | { type: 'meeting.audio'; meetingId: ID; turnId: ID; audio: string }
  | { type: 'meeting.ended'; meetingId: ID; state: AppState }
  | { type: 'state'; state: AppState }

export interface KeyStatus {
  configured: boolean
  hint: string | null
  encrypted: boolean
}
