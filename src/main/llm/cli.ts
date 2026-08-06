import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import type Anthropic from '@anthropic-ai/sdk'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'
import type { ProviderSpec, SubscriptionSpec } from '@shared/providers'

/**
 * Subscription-backed generation.
 *
 * Instead of a metered API key, this drives the vendor's own command-line tool
 * — `claude` or `codex` — which is already signed in to the plan the user pays
 * for. Grove never sees, stores or transmits the login: it hands the CLI a
 * prompt and reads the answer back over a pipe.
 *
 * The trade this makes is tool calling. Neither CLI will surface a structured
 * function call to a caller, so tools are expressed as a text protocol and
 * parsed out of the reply. Frontier models follow it reliably; the API-key path
 * still uses real native tool calls and remains the better option for long
 * autonomous runs.
 */

/* ── Finding the executable ──────────────────────────────────────────────── */

/**
 * A GUI-launched Electron app inherits a bare PATH from launchd, not the one
 * from the user's shell profile — so the CLI they installed with npm or brew is
 * invisible unless we go looking for it.
 */
const SEARCH_DIRS = [
  join(homedir(), '.local', 'bin'),
  join(homedir(), '.bun', 'bin'),
  join(homedir(), '.volta', 'bin'),
  join(homedir(), '.nvm', 'versions'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin'
]

const resolved = new Map<string, string | null>()

/** Asks the user's login shell where a command lives, profile and all. */
const askLoginShell = (command: string): string | null => {
  try {
    const shell = process.env['SHELL'] || '/bin/zsh'
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
    const output = execFileSync(shell, ['-lc', `command -v ${command}`], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const path = output.trim().split('\n').pop()?.trim()
    return path && existsSync(path) ? path : null
  } catch {
    return null
  }
}

export const resolveCommand = (command: string): string | null => {
  const cached = resolved.get(command)
  if (cached !== undefined) return cached

  const fromPath = (process.env['PATH'] ?? '').split(':').filter(Boolean)
  for (const dir of [...fromPath, ...SEARCH_DIRS]) {
    const candidate = join(dir, command)
    if (existsSync(candidate)) {
      resolved.set(command, candidate)
      return candidate
    }
  }

  const found = askLoginShell(command)
  resolved.set(command, found)
  return found
}

/** Clears the lookup cache so a freshly installed CLI is picked up. */
export const forgetCommands = (): void => resolved.clear()

export interface CliStatus {
  installed: boolean
  path: string | null
  signedIn: boolean
}

/**
 * Whether the plan is usable. "Signed in" is judged from the credential file
 * each CLI writes on login — cheaper and quieter than burning a request.
 */
export const cliStatus = (spec: SubscriptionSpec): CliStatus => {
  const path = resolveCommand(spec.command)
  return { installed: Boolean(path), path, signedIn: path ? hasSession(spec.command) : false }
}

const hasSession = (command: string): boolean => {
  if (command === 'codex') {
    const home = process.env['CODEX_HOME'] ?? join(homedir(), '.codex')
    return existsSync(join(home, 'auth.json'))
  }
  if (command === 'claude') {
    // Claude Code keeps its OAuth session in the login keychain and only
    // records the account in config, so the config file is the signal we have
    // without prompting for keychain access on every check.
    return (
      existsSync(join(homedir(), '.claude', '.credentials.json')) ||
      existsSync(join(homedir(), '.claude.json')) ||
      existsSync(join(homedir(), '.claude'))
    )
  }
  return true
}

/* ── The tool protocol ───────────────────────────────────────────────────── */

const OPEN = '<use_tool>'

const toolProtocol = (tools: Anthropic.Tool[]): string =>
  [
    '',
    '# Acting through tools',
    '',
    'You can act on the world. To call a tool, finish your reply with exactly one block in this form, and write nothing after it:',
    '',
    OPEN,
    '<name>the_tool_name</name>',
    '<input>{"argument": "value"}</input>',
    '</use_tool>',
    '',
    'Rules:',
    '- The input must be a single valid JSON object matching that tool’s schema.',
    '- One call per reply. You will be shown the result and can then call another.',
    '- Never wrap the block in a code fence and never explain the block afterwards.',
    '- When you have what you need, reply normally with no block. That ends the turn.',
    '',
    '## Tools available to you',
    '',
    ...tools.map((tool) =>
      [
        `### ${tool.name}`,
        tool.description ?? '',
        `Input schema: ${JSON.stringify(tool.input_schema)}`,
        ''
      ].join('\n')
    )
  ].join('\n')

const CALL = /<use_tool>\s*<name>\s*([\w.-]+)\s*<\/name>\s*<input>([\s\S]*?)<\/input>\s*<\/use_tool>/

/** Renders one message block into the flat transcript the CLI receives. */
const renderBlock = (block: ContentBlockParam): string => {
  switch (block.type) {
    case 'text':
      return block.text
    case 'tool_use':
      return `${OPEN}\n<name>${block.name}</name>\n<input>${JSON.stringify(block.input)}</input>\n</use_tool>`
    case 'tool_result': {
      const body = Array.isArray(block.content)
        ? block.content
            .map((part) => (part.type === 'text' ? part.text : `[${part.type}]`))
            .join('\n')
        : String(block.content ?? '')
      return `<tool_result${block.is_error ? ' status="error"' : ''}>\n${body}\n</tool_result>`
    }
    default:
      return ''
  }
}

/**
 * Both CLIs take one prompt, not a message array, so the conversation is
 * flattened into a labelled transcript. Tool calls and results are rendered in
 * the same syntax the model is asked to emit, which keeps the format it sees on
 * the way in identical to the one it is asked for on the way out.
 */
const flatten = (messages: Anthropic.MessageParam[]): string => {
  const turns = messages.map((message) => {
    const body =
      typeof message.content === 'string'
        ? message.content
        : message.content.map(renderBlock).filter(Boolean).join('\n\n')
    return `<turn from="${message.role === 'user' ? 'principal' : 'you'}">\n${body}\n</turn>`
  })
  return [
    'Here is the conversation so far. Continue it — reply only as your next turn.',
    '',
    ...turns
  ].join('\n\n')
}

/* ── Running the CLI ─────────────────────────────────────────────────────── */

export interface CliRun {
  text: string
  tokensIn: number
  tokensOut: number
}

const run = (
  path: string,
  args: string[],
  stdin: string,
  onLine: (line: string) => void,
  signal?: AbortSignal
): Promise<{ code: number; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(path, args, {
      // A neutral working directory: these CLIs read project context from cwd,
      // and Grove is generating prose, not editing anyone's repository.
      cwd: tmpdir(),
      env: {
        ...process.env,
        PATH: [...(process.env['PATH'] ?? '').split(':'), ...SEARCH_DIRS].filter(Boolean).join(':')
      },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stderr = ''
    let buffer = ''

    const onAbort = (): void => {
      child.kill('SIGTERM')
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk
      const parts = buffer.split('\n')
      buffer = parts.pop() ?? ''
      for (const line of parts) if (line.trim()) onLine(line)
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })

    child.on('error', (error) => {
      signal?.removeEventListener('abort', onAbort)
      reject(error)
    })
    child.on('close', (code) => {
      signal?.removeEventListener('abort', onAbort)
      if (buffer.trim()) onLine(buffer)
      resolve({ code: code ?? 0, stderr })
    })

    child.stdin.end(stdin)
  })

/** Claude Code: `-p` with a JSON stream, tools off — we only want the prose. */
const runClaude = async (
  path: string,
  model: string,
  system: string,
  prompt: string,
  effort: string,
  onText: ((chunk: string) => void) | undefined,
  signal?: AbortSignal
): Promise<CliRun> => {
  let text = ''
  let tokensIn = 0
  let tokensOut = 0
  let failure: string | null = null
  // Text stops being streamed the moment a tool block starts, so the protocol
  // syntax never reaches the transcript the user is reading.
  let streaming = true

  const emit = (chunk: string): void => {
    text += chunk
    if (!streaming) return
    if (text.includes(OPEN)) {
      streaming = false
      return
    }
    onText?.(chunk)
  }

  const { code, stderr } = await run(
    path,
    [
      '-p',
      '--model',
      model,
      '--system-prompt',
      system,
      '--effort',
      effort,
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--verbose',
      // Grove supplies its own tools through the text protocol; Claude Code's
      // own file and shell tools have no business in this process.
      '--disallowedTools',
      'Bash Edit Write Read Glob Grep WebFetch WebSearch Task TodoWrite NotebookEdit',
      '--strict-mcp-config',
      '--settings',
      JSON.stringify({ disableAllHooks: true })
    ],
    prompt,
    (line) => {
      let event: Record<string, any>
      try {
        event = JSON.parse(line)
      } catch {
        return
      }

      if (event['type'] === 'stream_event') {
        const inner = event['event'] as Record<string, any> | undefined
        if (inner?.['type'] === 'content_block_delta' && inner['delta']?.['type'] === 'text_delta') {
          emit(String(inner['delta']['text']))
        }
        return
      }

      if (event['type'] === 'result') {
        const usage = (event['usage'] ?? {}) as Record<string, number>
        tokensIn = Number(usage['input_tokens'] ?? 0)
        tokensOut = Number(usage['output_tokens'] ?? 0)
        if (event['is_error']) failure = String(event['result'] ?? 'Claude Code reported an error.')
        // Partial events are best-effort; the result carries the whole reply.
        else if (!text && typeof event['result'] === 'string') text = event['result']
      }
    },
    signal
  )

  if (failure) throw new Error(failure)
  if (code !== 0 && !text) throw new Error(stderr.trim() || `claude exited with code ${code}.`)
  return { text, tokensIn, tokensOut }
}

/** Codex: JSONL events for streaming, and the final message read from a file. */
const runCodex = async (
  path: string,
  model: string,
  system: string,
  prompt: string,
  onText: ((chunk: string) => void) | undefined,
  signal?: AbortSignal
): Promise<CliRun> => {
  const scratch = mkdtempSync(join(tmpdir(), 'grove-codex-'))
  const outFile = join(scratch, 'reply.txt')
  let streamed = ''
  let streaming = true
  let tokensIn = 0
  let tokensOut = 0

  try {
    const { code, stderr } = await run(
      path,
      [
        'exec',
        '--json',
        '--skip-git-repo-check',
        '--ephemeral',
        '-m',
        model,
        '-s',
        'read-only',
        '-c',
        'approval_policy="never"',
        '-C',
        scratch,
        '-o',
        outFile,
        '-'
      ],
      `${system}\n\n${prompt}`,
      (line) => {
        let event: Record<string, any>
        try {
          event = JSON.parse(line)
        } catch {
          return
        }
        // Codex's event names have moved between releases, so match on shape
        // rather than on an exact type string.
        const delta = event['delta'] ?? event['msg']?.['delta']
        if (typeof delta === 'string' && streaming) {
          streamed += delta
          if (streamed.includes(OPEN)) streaming = false
          else onText?.(delta)
        }
        const usage = event['usage'] ?? event['msg']?.['usage']
        if (usage) {
          tokensIn = Number(usage['input_tokens'] ?? usage['prompt_tokens'] ?? tokensIn)
          tokensOut = Number(usage['output_tokens'] ?? usage['completion_tokens'] ?? tokensOut)
        }
      },
      signal
    )

    const final = existsSync(outFile) ? readFileSync(outFile, 'utf8').trim() : ''
    if (!final && code !== 0) throw new Error(stderr.trim() || `codex exited with code ${code}.`)
    return { text: final || streamed, tokensIn, tokensOut }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

/* ── Entry point ─────────────────────────────────────────────────────────── */

export class SubscriptionUnavailable extends Error {
  constructor(spec: SubscriptionSpec) {
    super(
      `The ${spec.command} command is not installed, so Grove cannot reach your ${spec.label} plan. Install it with: ${spec.install}`
    )
  }
}

export interface CliTurn {
  content: ContentBlockParam[]
  stopReason: 'tool_use' | 'end_turn'
  tokensIn: number
  tokensOut: number
}

export const runSubscriptionTurn = async (
  provider: ProviderSpec,
  options: {
    model: string
    system: string
    messages: Anthropic.MessageParam[]
    tools: Anthropic.Tool[]
    effort: 'low' | 'medium' | 'high'
    onText?: (chunk: string) => void
    signal?: AbortSignal
  }
): Promise<CliTurn> => {
  const spec = provider.subscription
  if (!spec) throw new Error(`${provider.name} has no subscription option.`)
  const path = resolveCommand(spec.command)
  if (!path) throw new SubscriptionUnavailable(spec)

  const system = options.tools.length
    ? `${options.system}\n${toolProtocol(options.tools)}`
    : options.system

  const prompt = flatten(options.messages)

  const result =
    spec.command === 'claude'
      ? await runClaude(path, options.model, system, prompt, options.effort, options.onText, options.signal)
      : await runCodex(path, options.model, system, prompt, options.onText, options.signal)

  return parseReply(result)
}

/** Splits a reply into its prose and, if present, the one tool call it made. */
export const parseReply = (result: CliRun): CliTurn => {
  const match = CALL.exec(result.text)
  if (!match) {
    return {
      content: [{ type: 'text', text: result.text.trim() }],
      stopReason: 'end_turn',
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut
    }
  }

  const [block, name, rawInput] = match
  const prose = result.text.slice(0, match.index).trim()

  let input: Record<string, unknown> = {}
  try {
    input = JSON.parse(rawInput!.trim()) as Record<string, unknown>
  } catch {
    // A malformed argument object should cost one retry, not the whole run —
    // the tool will answer with a schema complaint and the model can correct.
  }

  const content: ContentBlockParam[] = []
  if (prose) content.push({ type: 'text', text: prose })
  content.push({
    type: 'tool_use',
    // The id only has to survive the round trip back to us.
    id: `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: name!,
    input
  })

  void block
  return {
    content,
    stopReason: 'tool_use',
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut
  }
}
