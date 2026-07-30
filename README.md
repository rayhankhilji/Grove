<div align="center">

# Stobs

**An AI personal CEO for macOS.**

Not a chat window. A standing team of agents that holds your objectives, works your
inbox and calendar, runs on a schedule, and tells you when your hours stopped
matching your priorities.

Bring your own Anthropic key. Everything stays on your Mac.

</div>

---

## What it actually is

Most "AI assistant" apps are a text box in front of a model. Stobs is built the
other way round: the model is the engine, and the product is the operating
system around it — a team of specialised agents, a real workspace they mutate,
connectors to the tools you already use, automations that fire without you, and
a ledger of where your attention actually went.

**The team.** Five agents ship with the app, each with its own instructions,
model, tool allowlist and handoff rules.

| Agent | Remit |
|---|---|
| **Chief of Staff** | Runs your objectives and decides what today is for. The default. |
| **Inbox** | Triages mail and surfaces only what needs you. |
| **Scheduler** | Guards the calendar and protects deep work. |
| **Analyst** | Pulls the numbers — and holds your hours against your goals. |
| **Comms** | Writes anything that leaves the building. |

They hand work to each other. Ask the Chief of Staff to sort your morning and it
delegates mail triage to Inbox and scheduling to Scheduler, then builds on what
comes back — every sub-run visible in the timeline. You can edit any of them or
add your own.

**The workspace is real.** Agents don't describe what you should do; they call
tools that change state. Goals become objectives with measurable key results.
Numbers get recorded against a baseline, so 25k against a 10k→40k target reads
as 50% and not 62%. Consequential choices become framed decisions with genuine
options and a committed recommendation.

**Automations.** Chain agents into workflows and put them on a schedule — a
7am brief, a 5pm inbox sweep, a Friday review that pulls the week's numbers.
Each step is a real agent run you can open and inspect.

**Approval gates.** Agents are supervised by default: anything with an effect
outside your Mac — sending mail, posting to Slack, publishing to LinkedIn —
stops and asks. Approve inline in chat, or from the menu bar. Local changes to
your own workspace never interrupt you.

---

## The boardroom

Put a bench of advisers in a room, hand them your deck or your numbers, and let
them argue. Each seat generates independently with only its own persona in
context, so the voices stay distinct instead of collapsing into one narrator.
Least-recently-spoken selection keeps a long call balanced — and naming someone
puts them on the spot, so "Munger, what breaks this?" gets you Munger next.

Eight advisers, each covering something the others don't:

| Seat | What it's for |
|---|---|
| **Paul Graham** | Whether anyone actually wants this yet |
| **Steve Jobs** | Whether it's worth making, and what to delete |
| **Sam Altman** | Whether it's ambitious enough, and whether it compounds |
| **Naval Ravikant** | Whether you own the leverage or are renting it |
| **Andrej Karpathy** | Whether the technical claim survives an eval |
| **Charlie Munger** | How this fails, and which incentive explains the behaviour |
| **Patrick Collison** | Whether the details hold up under real use |
| **Jeff Bezos** | Whether you're overthinking a reversible decision |

**The personas are markdown, not config.** Each lives in
`src/shared/personas/*.md` — a long, specific account of what that person has
publicly argued, how they reason, what they push on, and how they actually
talk. Editable, reviewable in a diff, and long enough to encode a real point of
view rather than an adjective. A shared `_house.md` carries the call rules: two
to five sentences, lead with the position, disagree by name, ask only when the
answer would change your advice, and an explicit ban on the phrases that make
generated dialogue read as slop.

They are interpretations built from public material. They never claim to be the
real people, never fabricate quotations, and say so if asked.

Seven meeting kinds (board, pitch review, product critique, strategy, crisis,
hiring debrief, roast), six preset benches, and minutes at the end. Decks are
read on this Mac — PDFs through PDFKit, Office files straight out of their XML.

---

## The company brain

A single collected context layer that every agent and every boardroom seat
reads from. Explain your pricing, your positioning or last quarter's numbers
once, and it is present in every room after that instead of being retyped into
a prompt. Import files, or let agents file what they learn themselves via
`brain_search` and `brain_add`. Pinned entries ride along in every conversation
regardless of relevance; everything else is retrieved by match.

---

## Models

Claude runs on the official Anthropic SDK. Everything else speaks the OpenAI
chat-completions dialect, so one adapter covers the cheap end of the market —
Anthropic's message shape stays canonical internally and is translated at the
edge, streaming and tool calls included.

| Provider | Why |
|---|---|
| **Anthropic** | Opus 5 / Sonnet 5 / Haiku 4.5 — judgement work |
| **DeepSeek** | ~$0.27/Mtok. The cheapest capable option |
| **Groq** | Absurdly fast — ideal for boardroom turn-taking |
| **OpenRouter** | One key, hundreds of models |
| **Google Gemini** | Huge context, generous free tier |
| **OpenAI** | If you already have a key |
| **Ollama** | Local, free, private. No network at all |

Agents and boardroom seats pick models independently, so a long call can run on
something cheap while the Chief of Staff stays on Opus.

**Voice** is Fish Audio, with a voice slot per seat. Use voices you hold rights
to — Fish's licensed marketplace voices or models you made yourself. Stobs will
not help you clone a real person to put words in their mouth.

## The macOS part

This is the half a browser tab cannot do.

**Apple apps, natively.** Calendar, Reminders, Notes and Mail on this Mac,
through the accounts already signed in there. No OAuth, no cloud round trip, no
setup — 11 actions that work the moment you install. macOS asks your permission
the first time an agent reaches each app.

**The attention ledger.** Stobs samples which application is frontmost every 20
seconds while you're active, and builds a record of where your hours actually
went. The Analyst can read it directly, which is what turns "you said shipping
was the priority" into "you said shipping was the priority and spent 4h 12m in
Slack and 38m in your editor."

> It records **application names and durations only**. Never screenshots, never
> keystrokes, never window contents beyond the title an app already puts in its
> own title bar. It stays on your Mac, and it has an off switch in three places.

**Menu bar and hotkey.** Live run status in the menu bar, a badge when an agent
is waiting on your approval, and ⌥Space to summon Stobs from anywhere.

---

## Connections

Eight external providers, on top of the native Apple apps:

| | Provider | Auth | Notes |
|---|---|---|---|
| ✉️ | **Gmail & Google Calendar** | OAuth | Search, read, send, draft, list and create events |
| ✉️ | **Outlook & Microsoft 365** | OAuth (PKCE, no secret) | Mail and calendar via Microsoft Graph |
| 💬 | **Slack** | OAuth | Channels, history, post as you |
| 🔗 | **LinkedIn** | OAuth | Profile and publishing only — see below |
| 📄 | **Notion** | Integration token | Search, read, create pages |
| 📐 | **Linear** | API key | Issues, create, comment |
| 🐙 | **GitHub** | Fine-grained PAT | Assigned issues, repo activity, open issues |
| ✅ | **Todoist** | API token | List, create, complete |

**You supply the OAuth app.** Desktop applications cannot ship a client secret
safely, so Stobs asks for your own client ID (and secret, where the provider
still requires one at the token endpoint). The Connections screen links straight
to each provider's console and shows the exact redirect URI to paste in. Auth is
OAuth 2.0 with PKCE against a loopback listener on `127.0.0.1:8721`; tokens
refresh automatically and live encrypted in your Keychain.

**On LinkedIn, honestly:** their API grants general apps your own profile and
the ability to post. There is no feed reading, no messaging, and no connection
data — that access is not available, and no app can give it to you.

---

## Install

Requires macOS and Node 20+.

```bash
git clone https://github.com/rayhankhilji/stobs.git
cd stobs
npm install
npm run dev
```

Then open **Settings** and paste an [Anthropic API key](https://console.anthropic.com/settings/keys).

To build a signed-in-place `.app` and DMG:

```bash
npm run dist
```

The build is unsigned by default. On first launch macOS will need you to allow
it under System Settings → Privacy & Security.

---

## Models

Stobs runs on the current Claude family, with adaptive thinking and effort
control. Each agent can override the default independently.

| Model | When |
|---|---|
| `claude-opus-5` | Deepest judgement. The default — a personal CEO is a judgement job. |
| `claude-sonnet-5` | Near-Opus quality, faster and cheaper. |
| `claude-haiku-4-5` | Fastest. Good for quick capture. |

Adaptive thinking and the `effort` parameter are only sent to models that accept
them, so switching to Haiku doesn't produce a 400.

---

## Privacy

- Your Anthropic key, OAuth tokens and API keys are encrypted with Electron's
  `safeStorage`, which derives its key from the **macOS Keychain**. If encryption
  is ever unavailable, credentials are held in memory for the session — a
  plaintext secret is never written to disk as a fallback.
- All workspace data lives in one JSON file under
  `~/Library/Application Support/stobs/`. Writes are atomic.
- Nothing routes through any server of ours, because there isn't one. Requests
  go to Anthropic and to the providers you connect, directly.
- The renderer runs under a strict CSP with context isolation on and Node
  disabled. Model output is parsed as markdown and sanitised before it reaches
  the DOM.

---

## Architecture

```
src/
├── shared/
│   ├── personas/    One markdown file per adviser — the prompts, as prose
│   ├── providers.ts Model catalogue across every provider
│   └── types.ts     Shared verbatim across processes
├── main/
│   ├── store.ts     Single JSON source of truth, atomic writes
│   ├── vault.ts     Keychain-backed secrets: API key + per-provider credentials
│   ├── tools.ts     Unified tool registry — workspace + brain + native + connectors
│   ├── brain.ts     The collected context layer
│   ├── boardroom.ts Live multi-persona calls
│   ├── llm/         Provider dispatch + the OpenAI-compatible adapter
│   ├── chat.ts      Streaming conversation loop
│   ├── workflows.ts Workflow engine and the schedule ticker
│   ├── agents/      Agent definitions and the shared execution runtime
│   ├── connectors/  OAuth (PKCE + loopback), API clients, connection manager
│   ├── voice/       Fish Audio text to speech
│   └── native/      Apple bridge, attention, menu bar, hotkey, file extraction
├── preload/         The only surface the window can touch
└── renderer/        React UI — views, custom icon set, brand marks
```

**One execution loop.** Chat and background runs go through the same
`execute()` in `agents/runtime.ts`, so an agent behaves identically whether you
talk to it or schedule it. Handoffs recurse into it with a depth cap; approvals
suspend it on a promise the UI resolves.

**Tools are gated at call time.** An agent's allowlist is intersected with what
is actually connected, so a Gmail tool simply isn't offered to the model until
Gmail is connected — rather than being offered and failing.

**Prior turns replay as text.** Tool effects already live in the state snapshot
that every system prompt carries, so conversation history doesn't re-send
`tool_use`/`tool_result` pairs. Less context, no pairing errors.

---

## Verifying

The logic that carries real weight is covered by a headless suite — no API key,
no window:

```bash
npm run verify
```

It exercises the workspace tools, the tool registry and its wire encoding
(Anthropic tool names can't contain dots, so ids are flattened), per-agent tool
gating against live connections, the built-in team's wiring, provider/model
resolution, persona-file parsing and prose quality, brain retrieval and pinning,
and the scheduler's next-fire maths — 51 checks. `npm run build` runs it, plus both typechecks, before bundling.

---

## Licence

MIT.
