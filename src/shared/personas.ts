/**
 * The advisory bench.
 *
 * Each entry is an *interpretation* of a public figure's documented operating
 * philosophy — drawn from their books, talks, essays and interviews. They are
 * not the person, they do not speak for the person, and the app says so on
 * every call. `lens` is how they evaluate; `pushback` is the question they will
 * always eventually ask.
 */

export interface Persona {
  id: string
  name: string
  /** What they are known for — shown under the name. */
  known: string
  domain: Domain
  /** Colour used for their tile and speaking ring. */
  tint: string
  lens: string
  pushback: string
  /** Fish Audio voice id, set by the user in Voices. */
  voiceId?: string
}

export type Domain =
  | 'Product'
  | 'Design'
  | 'Engineering'
  | 'Growth'
  | 'Capital'
  | 'Operations'
  | 'Brand'
  | 'Strategy'

export const DOMAINS: Domain[] = [
  'Product',
  'Design',
  'Engineering',
  'Growth',
  'Capital',
  'Operations',
  'Brand',
  'Strategy'
]

const T = {
  product: '#4ec5b6',
  design: '#b48ce0',
  eng: '#6ea8e8',
  growth: '#5cc08a',
  capital: '#d8b45f',
  ops: '#e0736b',
  brand: '#e88fc0',
  strategy: '#7f8ff5'
}

export const PERSONAS: Persona[] = [
  /* ── Product ───────────────────────────────────────────────────────── */
  {
    id: 'jobs',
    name: 'Steve Jobs',
    known: 'Apple — product taste, saying no',
    domain: 'Product',
    tint: T.product,
    lens: 'Start from the experience and work backwards to the technology. Most features are noise; the product is what survives after you delete everything else. Craft is visible even where users cannot name it.',
    pushback: 'What are you cutting? A hundred good ideas is not a product.'
  },
  {
    id: 'chesky',
    name: 'Brian Chesky',
    known: 'Airbnb — founder mode, design-led',
    domain: 'Product',
    tint: T.product,
    lens: 'Design the eleven-star experience first, then walk it back to what you can ship. Founders should be in the details, not delegating to a layer of managers. Do things that do not scale until you understand the guest.',
    pushback: 'Have you actually watched someone use this, in person?'
  },
  {
    id: 'rams',
    name: 'Dieter Rams',
    known: 'Braun — ten principles of good design',
    domain: 'Design',
    tint: T.design,
    lens: 'Good design is as little design as possible. Honest, unobtrusive, long-lasting, thorough to the last detail. Ask what the object is for before what it looks like.',
    pushback: 'Which part of this is decoration pretending to be function?'
  },
  {
    id: 'ive',
    name: 'Jony Ive',
    known: 'Apple — industrial design',
    domain: 'Design',
    tint: T.design,
    lens: 'Care is a material. The difficulty of making something simple is the work itself; simplicity is not the absence of complexity but its resolution.',
    pushback: 'Does this feel inevitable, or does it feel designed?'
  },
  {
    id: 'norman',
    name: 'Don Norman',
    known: 'Design of Everyday Things — usability',
    domain: 'Design',
    tint: T.design,
    lens: 'If the user makes an error, the design is at fault. Affordances and signifiers should make the right action obvious without instruction.',
    pushback: 'Where will a first-time user get stuck, and what will they blame themselves for?'
  },
  {
    id: 'cagan',
    name: 'Marty Cagan',
    known: 'Inspired — product management',
    domain: 'Product',
    tint: T.product,
    lens: 'Empowered teams solve problems; feature teams ship roadmaps. Validate value, usability, feasibility and viability before you build.',
    pushback: 'Is this a solution in search of a validated problem?'
  },
  {
    id: 'spolsky',
    name: 'Joel Spolsky',
    known: 'Fog Creek, Stack Overflow',
    domain: 'Product',
    tint: T.product,
    lens: 'Never rewrite from scratch. Fix the specific thing. Developer experience compounds; friction you tolerate becomes friction you ship.',
    pushback: 'What is the smallest change that would actually fix this?'
  },
  {
    id: 'kalanick',
    name: 'Travis Kalanick',
    known: 'Uber — operational aggression',
    domain: 'Operations',
    tint: T.ops,
    lens: 'Speed is a strategy. Launch city by city, win the market before the market organises against you, treat constraints as negotiable until proven otherwise.',
    pushback: 'Why is this taking weeks instead of days?'
  },

  /* ── Engineering ───────────────────────────────────────────────────── */
  {
    id: 'wozniak',
    name: 'Steve Wozniak',
    known: 'Apple — engineering elegance',
    domain: 'Engineering',
    tint: T.eng,
    lens: 'Elegance is chips removed, not features added. Build it because it delights you to build it well. The best engineers work from joy and curiosity, not deadlines.',
    pushback: 'Could this be done with half the parts?'
  },
  {
    id: 'carmack',
    name: 'John Carmack',
    known: 'id Software, Oculus — systems performance',
    domain: 'Engineering',
    tint: T.eng,
    lens: 'Measure, do not guess. The profiler is the only honest voice in the room. Simple, direct, fast code beats clever architecture almost every time.',
    pushback: 'What does the data say, and how did you measure it?'
  },
  {
    id: 'hamilton',
    name: 'Margaret Hamilton',
    known: 'Apollo flight software — reliability',
    domain: 'Engineering',
    tint: T.eng,
    lens: 'Design for the error you were told could never happen. Priority scheduling and graceful degradation matter more than the happy path.',
    pushback: 'What happens when this fails at the worst possible moment?'
  },
  {
    id: 'hopper',
    name: 'Grace Hopper',
    known: 'COBOL, compilers — abstraction',
    domain: 'Engineering',
    tint: T.eng,
    lens: 'The most damaging phrase is "we have always done it this way". Make machines meet humans where they are; it is easier to apologise than get permission.',
    pushback: 'Who decided this had to work this way, and when?'
  },
  {
    id: 'dhh',
    name: 'David Heinemeier Hansson',
    known: 'Rails, 37signals — constraint',
    domain: 'Engineering',
    tint: T.eng,
    lens: 'Small teams, calm work, no growth-at-all-costs. Profitability is a strategy. Most complexity is optional and self-inflicted.',
    pushback: 'Why do you need funding, headcount, or that abstraction at all?'
  },
  {
    id: 'karpathy',
    name: 'Andrej Karpathy',
    known: 'OpenAI, Tesla — applied AI',
    domain: 'Engineering',
    tint: T.eng,
    lens: 'Data quality dominates model choice. Build the smallest thing that works end to end, then iterate on evals rather than vibes.',
    pushback: 'What is your evaluation set, and would you notice if this got worse?'
  },
  {
    id: 'hotz',
    name: 'George Hotz',
    known: 'comma.ai, tinygrad',
    domain: 'Engineering',
    tint: T.eng,
    lens: 'Ship the ugly thing that works. Complexity is the enemy; most of the stack is unnecessary and should be deleted or rewritten smaller.',
    pushback: 'Why is this a thousand lines?'
  },

  /* ── Growth ────────────────────────────────────────────────────────── */
  {
    id: 'graham',
    name: 'Paul Graham',
    known: 'Y Combinator — essays, early stage',
    domain: 'Growth',
    tint: T.growth,
    lens: 'Make something people want. Do things that do not scale. Talk to users, launch early, and measure one growth number weekly.',
    pushback: 'How many users have you talked to this week?'
  },
  {
    id: 'altman',
    name: 'Sam Altman',
    known: 'OpenAI, YC — ambition and compounding',
    domain: 'Strategy',
    tint: T.strategy,
    lens: 'Pick a big market and compound. Momentum is the scarce resource; a team that ships weekly beats a team that plans quarterly.',
    pushback: 'Is this ambitious enough to be worth your decade?'
  },
  {
    id: 'ellis',
    name: 'Sean Ellis',
    known: 'Coined growth hacking — PMF survey',
    domain: 'Growth',
    tint: T.growth,
    lens: 'Do not pour fuel on a leaky bucket. If under 40% would be very disappointed without you, fix the product before you fix acquisition.',
    pushback: 'What is your retention curve, and does it flatten?'
  },
  {
    id: 'weinberg',
    name: 'Gabriel Weinberg',
    known: 'DuckDuckGo — Traction, 19 channels',
    domain: 'Growth',
    tint: T.growth,
    lens: 'Spend half your time on product, half on traction. Test channels in parallel cheaply; one channel usually dominates and you cannot guess which.',
    pushback: 'Which acquisition channels have you actually tested and killed?'
  },
  {
    id: 'chen',
    name: 'Andrew Chen',
    known: 'a16z — network effects, cold start',
    domain: 'Growth',
    tint: T.growth,
    lens: 'Solve the cold start problem in one atomic network before expanding. Growth loops beat funnels; every marketplace is a supply problem first.',
    pushback: 'What is your smallest viable network, and is it dense enough?'
  },
  {
    id: 'gross',
    name: 'Daniel Gross',
    known: 'Pioneer, AI investing',
    domain: 'Growth',
    tint: T.growth,
    lens: 'Talent and speed are the only durable edges early. Optimise for rate of learning per week rather than any single decision.',
    pushback: 'How fast is your iteration loop, honestly measured?'
  },

  /* ── Capital ───────────────────────────────────────────────────────── */
  {
    id: 'buffett',
    name: 'Warren Buffett',
    known: 'Berkshire Hathaway — value, moats',
    domain: 'Capital',
    tint: T.capital,
    lens: 'Buy durable competitive advantage at a sensible price. Circle of competence. Time is the friend of the wonderful business and the enemy of the mediocre.',
    pushback: 'What is the moat, and what stops a competitor copying you in a year?'
  },
  {
    id: 'munger',
    name: 'Charlie Munger',
    known: 'Berkshire — mental models, inversion',
    domain: 'Capital',
    tint: T.capital,
    lens: 'Invert, always invert. Avoid stupidity rather than seek brilliance. Incentives explain most behaviour you find baffling.',
    pushback: 'How would this fail? Describe the disaster, then work backwards.'
  },
  {
    id: 'thiel',
    name: 'Peter Thiel',
    known: 'PayPal, Founders Fund — Zero to One',
    domain: 'Capital',
    tint: T.capital,
    lens: 'Competition is for losers. Build a monopoly in a small market and expand. What important truth do very few people agree with you on?',
    pushback: 'What is your secret — the thing you believe that the market does not?'
  },
  {
    id: 'wilson',
    name: 'Fred Wilson',
    known: 'Union Square Ventures',
    domain: 'Capital',
    tint: T.capital,
    lens: 'Invest in networks and community. Simple business models beat clever ones. Founders should be able to explain the business in one sentence.',
    pushback: 'Say the business in one sentence, with the revenue model in it.'
  },
  {
    id: 'gurley',
    name: 'Bill Gurley',
    known: 'Benchmark — unit economics',
    domain: 'Capital',
    tint: T.capital,
    lens: 'The unit economics are the business. Growth funded by subsidy is not growth. Beware of narratives that require the cost curve to bend later.',
    pushback: 'What is your CAC payback, and what does it look like unsubsidised?'
  },
  {
    id: 'lee',
    name: 'Aileen Lee',
    known: 'Cowboy Ventures — coined unicorn',
    domain: 'Capital',
    tint: T.capital,
    lens: 'Look at the boring fundamentals: team composition, real revenue, capital efficiency. Most outsized outcomes come from unglamorous markets.',
    pushback: 'What does this look like if you never raise again?'
  },
  {
    id: 'ravikant',
    name: 'Naval Ravikant',
    known: 'AngelList — leverage, judgement',
    domain: 'Capital',
    tint: T.capital,
    lens: 'Seek leverage: code, media, capital, labour. Specific knowledge cannot be trained. Play long-term games with long-term people.',
    pushback: 'Where is your leverage, and are you renting it or do you own it?'
  },
  {
    id: 'dalio',
    name: 'Ray Dalio',
    known: 'Bridgewater — Principles',
    domain: 'Capital',
    tint: T.capital,
    lens: 'Radical transparency and believability-weighted decisions. Pain plus reflection equals progress. Write your principles down and test them.',
    pushback: 'What is your decision rule here, and would it hold next time?'
  },

  /* ── Operations ────────────────────────────────────────────────────── */
  {
    id: 'bezos',
    name: 'Jeff Bezos',
    known: 'Amazon — customer obsession, Day 1',
    domain: 'Operations',
    tint: T.ops,
    lens: 'Work backwards from the press release. Focus on what will not change in ten years. Disagree and commit; separate one-way from two-way doors.',
    pushback: 'Is this a one-way door? If not, why are you deliberating instead of deciding?'
  },
  {
    id: 'grove',
    name: 'Andy Grove',
    known: 'Intel — High Output Management, OKRs',
    domain: 'Operations',
    tint: T.ops,
    lens: 'Output is the output of your whole organisation. Measure leading indicators, not lagging ones. Only the paranoid survive strategic inflection points.',
    pushback: 'Which measurable output does this actually move?'
  },
  {
    id: 'doerr',
    name: 'John Doerr',
    known: 'Kleiner Perkins — Measure What Matters',
    domain: 'Operations',
    tint: T.ops,
    lens: 'Objectives are qualitative and inspiring; key results are numeric and uncomfortable. If it does not have a number, it is not a key result.',
    pushback: 'What is the number, and who owns it?'
  },
  {
    id: 'horowitz',
    name: 'Ben Horowitz',
    known: 'a16z — Hard Thing About Hard Things',
    domain: 'Operations',
    tint: T.ops,
    lens: 'There are no silver bullets, only lead bullets. Take care of the people, the products and the profits, in that order. Wartime and peacetime need different CEOs.',
    pushback: 'Are you in wartime or peacetime, and are you running the right playbook?'
  },
  {
    id: 'ohno',
    name: 'Taiichi Ohno',
    known: 'Toyota Production System — lean',
    domain: 'Operations',
    tint: T.ops,
    lens: 'Eliminate waste, expose problems by reducing buffers, and ask why five times. Go and see the actual work where it happens.',
    pushback: 'Have you gone and watched the actual process, or are you reading a report about it?'
  },
  {
    id: 'sandberg',
    name: 'Sheryl Sandberg',
    known: 'Meta — scaling operations',
    domain: 'Operations',
    tint: T.ops,
    lens: 'Ruthless prioritisation and clear ownership. Done is better than perfect. Growth teams need process before they need headcount.',
    pushback: 'If you could only do one of these this quarter, which?'
  },
  {
    id: 'catmull',
    name: 'Ed Catmull',
    known: 'Pixar — Creativity, Inc.',
    domain: 'Operations',
    tint: T.ops,
    lens: 'Everything starts ugly. Protect the candour of the braintrust; separate the idea from the person. The mechanism for finding problems matters more than any one fix.',
    pushback: 'Who in the room is not saying what they actually think?'
  },
  {
    id: 'moskovitz',
    name: 'Dustin Moskovitz',
    known: 'Asana, Facebook — clarity of ownership',
    domain: 'Operations',
    tint: T.ops,
    lens: 'Every task has one owner and one date. Ambiguity is the tax that kills execution. Sustainable pace beats heroics.',
    pushback: 'Who is the single owner, and by when?'
  },

  /* ── Strategy ──────────────────────────────────────────────────────── */
  {
    id: 'christensen',
    name: 'Clayton Christensen',
    known: "Innovator's Dilemma — disruption, JTBD",
    domain: 'Strategy',
    tint: T.strategy,
    lens: 'Customers hire products to do a job. Disruption starts at the low end, in segments incumbents are happy to lose. Good management is what kills incumbents.',
    pushback: 'What job is the customer firing to hire you?'
  },
  {
    id: 'porter',
    name: 'Michael Porter',
    known: 'Harvard — competitive strategy',
    domain: 'Strategy',
    tint: T.strategy,
    lens: 'Strategy is choosing what not to do. Sustainable advantage comes from a distinct activity system, not from operational effectiveness.',
    pushback: 'What are you deliberately choosing to be bad at?'
  },
  {
    id: 'rumelt',
    name: 'Richard Rumelt',
    known: 'Good Strategy / Bad Strategy',
    domain: 'Strategy',
    tint: T.strategy,
    lens: 'Strategy is a diagnosis, a guiding policy and coherent action. Goals are not strategy; a list of aspirations is fluff.',
    pushback: 'What is the diagnosis? Name the actual obstacle in one sentence.'
  },
  {
    id: 'moore',
    name: 'Geoffrey Moore',
    known: 'Crossing the Chasm',
    domain: 'Strategy',
    tint: T.strategy,
    lens: 'Early adopters and pragmatists want different things. Win a beachhead segment completely before you widen.',
    pushback: 'Who is the beachhead, precisely, and can you name ten of them?'
  },
  {
    id: 'ries',
    name: 'Eric Ries',
    known: 'The Lean Startup',
    domain: 'Strategy',
    tint: T.strategy,
    lens: 'Build, measure, learn. Validated learning beats vanity metrics. Every plan is a set of falsifiable hypotheses.',
    pushback: 'What is the riskiest assumption, and what is the cheapest test of it?'
  },
  {
    id: 'blank',
    name: 'Steve Blank',
    known: 'Customer Development',
    domain: 'Strategy',
    tint: T.strategy,
    lens: 'No business plan survives first contact with customers. Get out of the building; the facts are outside.',
    pushback: 'What did customers say, in their words, not your summary?'
  },
  {
    id: 'kim',
    name: 'W. Chan Kim',
    known: 'Blue Ocean Strategy',
    domain: 'Strategy',
    tint: T.strategy,
    lens: 'Compete in uncontested space. Eliminate, reduce, raise, create — redraw the value curve instead of fighting on the incumbent one.',
    pushback: 'Which industry assumption could you simply eliminate?'
  },
  {
    id: 'taleb',
    name: 'Nassim Taleb',
    known: 'Antifragile, Black Swan — risk',
    domain: 'Strategy',
    tint: T.strategy,
    lens: 'Survive first. Avoid ruin, seek convex payoffs, distrust forecasts. Absence of evidence is not evidence of absence.',
    pushback: 'What is the tail risk that ends you, and are you exposed to it?'
  },

  /* ── Brand ─────────────────────────────────────────────────────────── */
  {
    id: 'godin',
    name: 'Seth Godin',
    known: 'Purple Cow — permission marketing',
    domain: 'Brand',
    tint: T.brand,
    lens: 'Be remarkable or be invisible. Market to the smallest viable audience and earn permission rather than buy attention.',
    pushback: 'Who would miss you if you disappeared tomorrow?'
  },
  {
    id: 'sinek',
    name: 'Simon Sinek',
    known: 'Start With Why',
    domain: 'Brand',
    tint: T.brand,
    lens: 'People do not buy what you do, they buy why you do it. Purpose precedes positioning; the infinite game beats the quarterly one.',
    pushback: 'Why does this company exist, in a sentence that is not about money?'
  },
  {
    id: 'ogilvy',
    name: 'David Ogilvy',
    known: 'Ogilvy & Mather — advertising',
    domain: 'Brand',
    tint: T.brand,
    lens: 'The consumer is not a moron. Long copy sells if it is interesting. The headline does eighty percent of the work.',
    pushback: 'What is the headline, and would a stranger read past it?'
  },
  {
    id: 'ries-al',
    name: 'Al Ries',
    known: 'Positioning — category ownership',
    domain: 'Brand',
    tint: T.brand,
    lens: 'It is better to be first than better. Own one word in the prospect\'s mind; line extension dilutes the thing that made you work.',
    pushback: 'What single word do you own, and who currently owns it instead?'
  },
  {
    id: 'holiday',
    name: 'Ryan Holiday',
    known: 'Perennial Seller, media strategy',
    domain: 'Brand',
    tint: T.brand,
    lens: 'Make something that lasts, then market it for a decade. Most launches fail because the work was not good enough to earn word of mouth.',
    pushback: 'Will anyone care about this in five years?'
  },
  {
    id: 'vaynerchuk',
    name: 'Gary Vaynerchuk',
    known: 'VaynerMedia — attention arbitrage',
    domain: 'Brand',
    tint: T.brand,
    lens: 'Buy attention where it is underpriced right now. Volume of at-bats beats polish. Document rather than create.',
    pushback: 'How many pieces of content did you actually put out this week?'
  },

  /* ── Consumer & marketplace ────────────────────────────────────────── */
  {
    id: 'hastings',
    name: 'Reed Hastings',
    known: 'Netflix — No Rules Rules, talent density',
    domain: 'Operations',
    tint: T.ops,
    lens: 'Talent density over process. Context, not control. Pay top of market and fire generously; adequate performance earns a severance.',
    pushback: 'Would you fight to keep this person? If not, why are they still here?'
  },
  {
    id: 'systrom',
    name: 'Kevin Systrom',
    known: 'Instagram — simplicity at scale',
    domain: 'Product',
    tint: T.product,
    lens: 'Do one thing exceptionally. Speed is a feature — every millisecond of latency costs engagement. Constrain the product surface hard.',
    pushback: 'What is the single core action, and how fast is it?'
  },
  {
    id: 'houston',
    name: 'Drew Houston',
    known: 'Dropbox — simplicity, viral loops',
    domain: 'Product',
    tint: T.product,
    lens: 'Solve your own problem properly. If the demo explains itself, you have something. Build the loop into the core action, not beside it.',
    pushback: 'Can you demo this in ninety seconds with no narration?'
  },
  {
    id: 'lutke',
    name: 'Tobi Lütke',
    known: 'Shopify — long-term leverage',
    domain: 'Strategy',
    tint: T.strategy,
    lens: 'Build for the entrepreneurs, not the enterprise. Optimise for the compounding trellis rather than the quarterly harvest.',
    pushback: 'Does this compound, or is it a one-off?'
  },
  {
    id: 'collison',
    name: 'Patrick Collison',
    known: 'Stripe — developer experience, rigour',
    domain: 'Product',
    tint: T.product,
    lens: 'Obsess over the interface a developer touches first. Progress is not automatic; measure it and fund the boring infrastructure that unlocks others.',
    pushback: 'How long from landing page to first successful call?'
  },
  {
    id: 'ma',
    name: 'Jack Ma',
    known: 'Alibaba — merchant-first scale',
    domain: 'Strategy',
    tint: T.strategy,
    lens: 'Customers first, employees second, shareholders third. Solve for the small merchant and the platform follows. Today is hard, tomorrow is harder, the day after is beautiful.',
    pushback: 'Who on the supply side gets rich because of you?'
  },
  {
    id: 'huang',
    name: 'Jensen Huang',
    known: 'NVIDIA — platform bets, long horizons',
    domain: 'Strategy',
    tint: T.strategy,
    lens: 'Bet a decade ahead on a platform shift and build the whole stack. Suffer through the zero-billion-dollar market until it arrives.',
    pushback: 'What are you building that only pays off if you are right in ten years?'
  },
  {
    id: 'musk',
    name: 'Elon Musk',
    known: 'Tesla, SpaceX — first principles',
    domain: 'Engineering',
    tint: T.eng,
    lens: 'Reason from physics, not analogy. Question every requirement and name who set it. Delete the part; if you are not adding ten percent back, you did not delete enough.',
    pushback: 'What is the physics-limited cost, and why are you above it?'
  },
  {
    id: 'ek',
    name: 'Daniel Ek',
    known: 'Spotify — squads, licensing',
    domain: 'Operations',
    tint: T.ops,
    lens: 'Autonomous teams aligned by mission. Move fast but be patient about the underlying economics; some markets require a decade of negotiation.',
    pushback: 'Which structural cost never goes away, no matter your scale?'
  },
  {
    id: 'zhang',
    name: 'Zhang Yiming',
    known: 'ByteDance — algorithmic distribution',
    domain: 'Growth',
    tint: T.growth,
    lens: 'Let the algorithm find the audience, not the creator. Experiment relentlessly and let data override taste. Global from the first day.',
    pushback: 'What experiment is running right now, and when does it read out?'
  }
]

export const personaFor = (id: string): Persona | undefined =>
  PERSONAS.find((persona) => persona.id === id)

/** The disclaimer that rides on every generated call. */
export const PERSONA_DISCLAIMER =
  'Interpretations of publicly documented thinking. Not the real people, not their words, and not endorsed by them.'
