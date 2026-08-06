/**
 * Headless checks over the parts of Grove that carry real logic: the workspace
 * tool layer, the tool registry and its wire encoding, per-agent tool gating,
 * the built-in team's wiring, and the scheduler's next-fire maths.
 *
 * Run with `npm run verify`. No API key and no window required.
 */
import { CONNECTORS, connectorToolId, grantCovers, providerGrant } from '../src/shared/connectors'
import { HOUSE_RULES, PERSONAS, personaFor } from '../src/shared/personas'
import { ALL_MODELS, PROVIDERS, SUBSCRIBABLE, providerOfModel } from '../src/shared/providers'
import { BENCHES, MEETING_KINDS } from '../src/main/boardroom'
import { MODELS } from '../src/shared/models'
import { BUILT_IN_AGENTS } from '../src/main/agents/defaults'
import { store } from '../src/main/store'
import { addEntry, context as brainContext, search as brainSearch, updateEntry } from '../src/main/brain'
import { vault } from '../src/main/vault'
import { nextRun } from '../src/main/workflows'
import { parseReply } from '../src/main/llm/cli'
import {
  ALL_TOOLS,
  CONNECTOR_SCHEMAS,
  definitionsFor,
  grantedTools,
  objectiveProgress,
  runTool,
  snapshot,
  toolsForAgent
} from '../src/main/tools'

let failures = 0
let checks = 0

const check = (label: string, condition: boolean, detail = ''): void => {
  checks += 1
  if (condition) {
    console.log(`  [32m✓[0m ${label}`)
  } else {
    failures += 1
    console.log(`  [31m✗[0m ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const group = (name: string): void => console.log(`\n[1m${name}[0m`)

const main = async (): Promise<void> => {
  store.init()
  vault.init()

  /* ── Workspace tools ──────────────────────────────────────────────── */

  group('Workspace tools')

  await runTool('update_profile', { name: 'Rayhan', role: 'founder', venture: 'Grove' })
  check('profile persists', store.get().profile.name === 'Rayhan')

  await runTool('set_objective', {
    title: 'Reach $40k MRR',
    why: 'Runway to hire.',
    horizon: 'next'
  })
  check('objective created', store.get().objectives.length === 1)

  await runTool('add_key_result', {
    objective: 'Reach $40k MRR',
    title: 'MRR',
    start: 10000,
    target: 40000,
    unit: '$'
  })
  check('key result resolved the objective by title', store.get().objectives[0]!.keyResults.length === 1)
  check('progress starts at 0%', objectiveProgress(store.get().objectives[0]!) === 0)

  await runTool('record_progress', { key_result: 'MRR', current: 25000 })
  check(
    'progress honours the baseline (25k of 10k→40k is 50%)',
    objectiveProgress(store.get().objectives[0]!) === 50
  )

  await runTool('add_task', { title: 'Ship pricing page', horizon: 'now', objective: 'Reach $40k MRR' })
  check('task linked to its objective', store.get().tasks[0]!.objectiveId === store.get().objectives[0]!.id)

  await runTool('complete_task', { task: 'Ship pricing' })
  check('task completed via partial title', store.get().tasks[0]!.done)

  await runTool('frame_decision', {
    question: 'Hire a second engineer now?',
    context: 'Runway is 9 months.',
    options: [
      { label: 'Hire now', upside: 'Ship faster', risk: 'Burn' },
      { label: 'Wait a quarter', upside: 'Safer runway', risk: 'Slower' }
    ],
    recommendation: 'Wait a quarter.'
  })
  check('decision logged with both options', store.get().decisions[0]!.options.length === 2)

  await runTool('resolve_decision', { decision: 'Hire a second', chosen: 'Wait a quarter' })
  check('decision resolved', store.get().decisions[0]!.status === 'decided')

  const missing = await runTool('record_progress', { key_result: 'nope', current: 5 })
  check('unknown key result reports cleanly', missing.result.includes('No key result'))

  const unknown = await runTool('not_a_tool', {})
  check('unknown tool flagged as an error', unknown.isError)

  /* ── Tool registry ────────────────────────────────────────────────── */

  group('Tool registry')

  const expectedConnectorTools = CONNECTORS.reduce((sum, spec) => sum + spec.actions.length, 0)
  const connectorTools = ALL_TOOLS.filter((tool) => tool.provider)
  check(
    `every connector action has a tool (${expectedConnectorTools})`,
    connectorTools.length === expectedConnectorTools,
    `found ${connectorTools.length}`
  )

  // An action that genuinely takes no arguments is fine; an action nobody wrote
  // a schema for at all is the bug. Checking membership rather than emptiness
  // means adding a connector action fails loudly until its schema exists.
  const unschemad = connectorTools.filter((tool) => !(tool.id in CONNECTOR_SCHEMAS))
  check(
    'every connector tool has a declared schema',
    unschemad.length === 0,
    unschemad.map((tool) => tool.id).join(', ')
  )

  const names = definitionsFor(ALL_TOOLS).map((definition) => definition.name)
  check(
    'wire names satisfy the API pattern ^[a-zA-Z0-9_-]{1,64}$',
    names.every((name) => /^[a-zA-Z0-9_-]{1,64}$/.test(name)),
    names.filter((name) => !/^[a-zA-Z0-9_-]{1,64}$/.test(name)).join(', ')
  )
  check('wire names are unique', new Set(names).size === names.length)

  /* ── Agent wiring ─────────────────────────────────────────────────── */

  group('Built-in team')

  const agents = BUILT_IN_AGENTS()
  const toolIds = new Set(ALL_TOOLS.map((tool) => tool.id))
  const agentIds = new Set(agents.map((agent) => agent.id))

  // A grant is either an exact tool id or a wildcard. Both have to resolve to
  // something real — a typo in `stripe.*` would otherwise fail silently, with
  // the agent simply never seeing the tools it was meant to have.
  const dangling = (grant: string): boolean =>
    grant.includes('*')
      ? ![...toolIds].some((toolId) => grantCovers(grant, toolId))
      : !toolIds.has(grant)

  check(
    'every tool grant resolves to a real tool',
    agents.every((agent) => !agent.toolIds.some(dangling)),
    agents.flatMap((agent) => agent.toolIds.filter(dangling)).join(', ')
  )
  check(
    'every handoff target exists',
    agents.every((agent) => agent.handoffIds.every((target) => agentIds.has(target)))
  )
  check(
    'no agent can hand off to itself',
    agents.every((agent) => !agent.handoffIds.includes(agent.id))
  )
  check(
    'every agent uses a known model',
    agents.every((agent) => MODELS.some((model) => model.id === agent.model))
  )

  group('Tool grants')

  check(
    'an exact grant covers only itself',
    grantCovers('stripe.stripe_balance', 'stripe.stripe_balance') &&
      !grantCovers('stripe.stripe_balance', 'stripe.stripe_revenue')
  )
  check(
    'a provider wildcard covers that provider and no other',
    grantCovers('stripe.*', 'stripe.stripe_revenue') && !grantCovers('stripe.*', 'github.github_issues')
  )
  check(
    'a wildcard never leaks across a name prefix',
    // `x.*` must not swallow a future provider whose id merely starts with x.
    !grantCovers('x.*', 'xero.xero_invoices')
  )
  check(
    'a provider wildcard expands to every action that provider offers',
    CONNECTORS.every((connector) => {
      const expanded = grantedTools([providerGrant(connector.id)])
      return expanded.length === connector.actions.length
    }),
    CONNECTORS.filter(
      (connector) => grantedTools([providerGrant(connector.id)]).length !== connector.actions.length
    )
      .map((connector) => connector.id)
      .join(', ')
  )
  check(
    'the standing team reaches every connector once it is connected',
    CONNECTORS.every((connector) =>
      agents.some((agent) =>
        agent.toolIds.some((grant) => grantCovers(grant, connectorToolId(connector.id, connector.actions[0]!.id)))
      )
    ),
    CONNECTORS.filter(
      (connector) =>
        !agents.some((agent) =>
          agent.toolIds.some((grant) =>
            grantCovers(grant, connectorToolId(connector.id, connector.actions[0]!.id))
          )
        )
    )
      .map((connector) => connector.id)
      .join(', ')
  )

  const inbox = agents.find((agent) => agent.id === 'inbox')!
  const gated = toolsForAgent(inbox)
  check(
    'tools from unconnected providers are withheld',
    gated.every((tool) => !tool.provider),
    gated.filter((tool) => tool.provider).map((tool) => tool.id).join(', ')
  )
  check('workspace tools stay available without any connection', gated.length > 0)

  // Simulate a live Google credential and confirm the gate opens.
  vault.saveProvider('google', { accessToken: 'test-token' })
  const opened = toolsForAgent(inbox)
  check(
    'connecting a provider exposes its tools',
    opened.some((tool) => tool.id === connectorToolId('google', 'gmail_search'))
  )
  check(
    'other providers stay withheld',
    !opened.some((tool) => tool.provider === 'microsoft')
  )
  vault.disconnectProvider('google')

  /* ── Providers ────────────────────────────────────────────────────── */

  group('Subscription bridge')

  const reply = (text: string) => parseReply({ text, tokensIn: 0, tokensOut: 0 })

  const plain = reply('The runway is eleven months at the current burn.')
  check('a reply with no tool block ends the turn', plain.stopReason === 'end_turn')
  check(
    'plain prose survives intact',
    plain.content[0]?.type === 'text' &&
      plain.content[0].text === 'The runway is eleven months at the current burn.'
  )

  const called = reply(
    'Let me check.\n<use_tool>\n<name>google__gmail_search</name>\n<input>{"query":"is:unread","limit":5}</input>\n</use_tool>'
  )
  check('a tool block is recognised', called.stopReason === 'tool_use')
  check(
    'the tool name and arguments are recovered',
    called.content.some(
      (block) =>
        block.type === 'tool_use' &&
        block.name === 'google__gmail_search' &&
        (block.input as { query?: string }).query === 'is:unread'
    )
  )
  check(
    'prose before the block is kept as text',
    called.content[0]?.type === 'text' && called.content[0].text === 'Let me check.'
  )
  check(
    'the protocol syntax never leaks into the transcript',
    !called.content.some((block) => block.type === 'text' && block.text.includes('<use_tool>'))
  )

  const broken = reply('<use_tool>\n<name>review</name>\n<input>{not json}</input>\n</use_tool>')
  check(
    'malformed arguments still produce a call rather than killing the turn',
    broken.stopReason === 'tool_use' &&
      broken.content.some((block) => block.type === 'tool_use' && block.name === 'review')
  )

  check(
    'every plan-backed provider names a command and an install route',
    SUBSCRIBABLE.every(
      (provider) =>
        provider.subscription!.command.length > 0 &&
        provider.subscription!.install.includes('install') &&
        provider.subscription!.installUrl.startsWith('https://')
    )
  )
  check(
    'every plan-backed provider offers at least one model on the plan',
    SUBSCRIBABLE.every((provider) => provider.models.some((model) => model.onPlan))
  )

  group('Providers')

  const modelIds = ALL_MODELS().map(({ model }) => model.id)
  check('model ids are unique across providers', new Set(modelIds).size === modelIds.length)
  check(
    'every model resolves back to its own provider',
    ALL_MODELS().every(({ provider, model }) => providerOfModel(model.id).id === provider.id)
  )
  check(
    'every non-local provider has a base URL or is Anthropic',
    PROVIDERS.every((provider) => provider.kind === 'anthropic' || Boolean(provider.baseUrl))
  )
  check(
    'only Anthropic models claim adaptive reasoning',
    ALL_MODELS().every(({ provider, model }) => !model.reasoning || provider.kind === 'anthropic')
  )
  check(
    'the cheap worker default is a real model',
    modelIds.includes('deepseek-chat')
  )

  /* ── Boardroom ────────────────────────────────────────────────────── */

  group('Boardroom')

  const personaIds = PERSONAS.map((persona) => persona.id)
  check(`the bench is a tight ${PERSONAS.length}`, PERSONAS.length >= 6 && PERSONAS.length <= 10)
  check('persona ids are unique', new Set(personaIds).size === personaIds.length)
  check(
    'every persona file parsed its frontmatter',
    PERSONAS.every(
      (persona) => persona.id && persona.name && persona.domain && persona.brief && persona.tint
    ),
    PERSONAS.filter((persona) => !persona.brief).map((persona) => persona.name).join(', ')
  )
  check(
    'every persona body is substantial prose, not a one-liner',
    PERSONAS.every((persona) => persona.body.length > 1500),
    PERSONAS.filter((persona) => persona.body.length <= 1500)
      .map((persona) => `${persona.name}:${persona.body.length}`)
      .join(', ')
  )
  check(
    'every persona states what they believe and how they talk',
    PERSONAS.every(
      (persona) =>
        persona.body.includes('actually believes') && persona.body.includes('How he talks')
    ),
    PERSONAS.filter((persona) => !persona.body.includes('How he talks'))
      .map((persona) => persona.name)
      .join(', ')
  )
  check(
    'house rules ban the slop phrases',
    ['Great question', 'It depends', 'unpack that'].every((phrase) =>
      HOUSE_RULES.includes(phrase)
    )
  )
  check(
    'house rules carry the not-the-real-person constraint',
    HOUSE_RULES.includes('interpretation, not the person')
  )
  check(
    'every suggested bench references real personas',
    BENCHES.every((bench) => bench.personaIds.every((id) => personaFor(id) !== undefined)),
    BENCHES.flatMap((bench) => bench.personaIds.filter((id) => !personaFor(id))).join(', ')
  )
  check(
    'every bench names a real meeting kind',
    BENCHES.every((bench) => MEETING_KINDS.some((kind) => kind.id === bench.kind))
  )
  check(
    'benches seat between three and eight',
    BENCHES.every((bench) => bench.personaIds.length >= 3 && bench.personaIds.length <= 8)
  )

  /* ── Company brain ────────────────────────────────────────────────── */

  group('Company brain')

  addEntry('Pricing', 'We charge $49 per seat per month. Enterprise starts at $2k.', 'you', ['pricing'])
  addEntry('Irrelevant note', 'Something about office plants.', 'you', [])
  check('entries are stored', store.get().brain.length === 2)

  const hits = brainSearch('pricing')
  check('search finds by title and tag', hits[0]?.title === 'Pricing', hits.map((h) => h.title).join(', '))

  check('unpinned context is empty without a query match', brainContext('plumbing') === '')
  check('context includes a matching entry', brainContext('what is our pricing').includes('$49'))

  // Pin by title — addEntry unshifts, so positional indexing is a trap.
  const plants = store.get().brain.find((entry) => entry.title === 'Irrelevant note')!
  updateEntry(plants.id, { pinned: true })
  check(
    'pinned entries ride along regardless of relevance',
    brainContext('completely unrelated query').includes('office plants')
  )

  /* ── Scheduler ────────────────────────────────────────────────────── */

  group('Scheduler')

  const weekdayRun = nextRun(9, 30, [1, 2, 3, 4, 5])
  check('next run lands in the future', weekdayRun.getTime() > Date.now())
  check('next run honours the weekday filter', [1, 2, 3, 4, 5].includes(weekdayRun.getDay()))
  check('next run uses the requested time', weekdayRun.getHours() === 9 && weekdayRun.getMinutes() === 30)

  const anyDay = nextRun(23, 59, [])
  check('an empty day list means every day', anyDay.getTime() > Date.now())

  /* ── Prompt assembly ──────────────────────────────────────────────── */

  group('Prompt assembly')

  const view = snapshot(store.get())
  check('snapshot names the principal', view.includes('Rayhan'))
  check('snapshot carries live numbers', view.includes('25000/40000'))
  check('snapshot lists the open decision count', view.includes('DECISIONS (0 open)'))

  store.flush()
  check('state survives a flush', store.get().objectives.length === 1)

  console.log(
    failures === 0
      ? `\n[32mAll ${checks} checks passed.[0m\n`
      : `\n[31m${failures} of ${checks} checks failed.[0m\n`
  )
  process.exit(failures === 0 ? 0 : 1)
}

void main()
