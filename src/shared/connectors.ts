import type { ConnectorSpec } from './types'

/**
 * The connector catalogue.
 *
 * Every entry points at a provider's real authorisation and token endpoints,
 * and every action listed here has a working client behind it — nothing is
 * declared that Grove cannot actually do.
 *
 * OAuth providers need a client id you create yourself, because a desktop app
 * cannot ship a shared one safely, and a few still require a client secret at
 * the token endpoint, which is what `needsSecret` marks. Providers whose OAuth
 * is closed to desktop clients use a personal access token instead. That is the
 * supported path for those services, not a workaround.
 */
export const CONNECTORS: ConnectorSpec[] = [
  {
    id: 'google',
    name: 'Google Workspace',
    category: 'Email',
    auth: 'oauth',
    note: 'Create an OAuth client of type “Desktop app”. Google issues a client secret for desktop clients and documents it as non-confidential. One connection covers Gmail, Calendar, Drive and Sheets.',
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    needsSecret: true,
    scopes: [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    actions: [
      { id: 'gmail_search', label: 'Search mail', description: 'Find messages with Gmail query syntax.', write: false },
      { id: 'gmail_read', label: 'Read a message', description: 'Read the full body of one message.', write: false },
      { id: 'gmail_send', label: 'Send mail', description: 'Send an email from your account.', write: true },
      { id: 'gmail_draft', label: 'Draft mail', description: 'Save a draft without sending.', write: true },
      { id: 'gcal_list', label: 'List events', description: 'Read calendar events in a window.', write: false },
      { id: 'gcal_create', label: 'Create event', description: 'Put a new event on your calendar.', write: true },
      { id: 'drive_search', label: 'Search Drive', description: 'Find files by name or full-text content.', write: false },
      { id: 'drive_read', label: 'Read a document', description: 'Read a Doc, Sheet or text file as plain text.', write: false },
      { id: 'sheets_read', label: 'Read a sheet', description: 'Read a range of cells from a spreadsheet.', write: false },
      { id: 'sheets_append', label: 'Append a row', description: 'Add a row to the end of a sheet.', write: true }
    ]
  },
  {
    id: 'microsoft',
    name: 'Microsoft 365',
    category: 'Email',
    auth: 'oauth',
    note: 'Register an app in Entra ID as a public client with redirect “http://localhost”. No client secret needed — Microsoft supports PKCE properly. Covers Outlook mail, calendar and OneDrive.',
    setupUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    needsSecret: false,
    scopes: [
      'offline_access',
      'User.Read',
      'Mail.ReadWrite',
      'Mail.Send',
      'Calendars.ReadWrite',
      'Files.Read.All'
    ],
    actions: [
      { id: 'outlook_search', label: 'Search mail', description: 'Search your Outlook mailbox.', write: false },
      { id: 'outlook_read', label: 'Read a message', description: 'Read one message in full.', write: false },
      { id: 'outlook_send', label: 'Send mail', description: 'Send an email from Outlook.', write: true },
      { id: 'mscal_list', label: 'List events', description: 'Read Outlook calendar events.', write: false },
      { id: 'mscal_create', label: 'Create event', description: 'Add an event to Outlook calendar.', write: true },
      { id: 'onedrive_search', label: 'Search OneDrive', description: 'Find files in OneDrive and SharePoint.', write: false }
    ]
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Messaging',
    auth: 'oauth',
    note: 'Create a Slack app, add the user scopes below, and set the redirect URL to the loopback address Grove shows during connect.',
    setupUrl: 'https://api.slack.com/apps',
    authUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    needsSecret: true,
    scopes: ['channels:read', 'channels:history', 'chat:write', 'users:read', 'search:read'],
    actions: [
      { id: 'slack_channels', label: 'List channels', description: 'See the channels you are in.', write: false },
      { id: 'slack_history', label: 'Read a channel', description: 'Read recent messages in a channel.', write: false },
      { id: 'slack_search', label: 'Search messages', description: 'Search your workspace history.', write: false },
      { id: 'slack_post', label: 'Post a message', description: 'Send a message as you.', write: true }
    ]
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'Messaging',
    auth: 'token',
    note: 'Create an application, add a bot, copy its token, and invite the bot to the servers you want Grove to reach.',
    setupUrl: 'https://discord.com/developers/applications',
    tokenLabel: 'Bot token',
    actions: [
      { id: 'discord_guilds', label: 'List servers', description: 'Servers the bot has been invited to.', write: false },
      { id: 'discord_channels', label: 'List channels', description: 'Channels in one server.', write: false },
      { id: 'discord_history', label: 'Read a channel', description: 'Read recent messages in a channel.', write: false },
      { id: 'discord_post', label: 'Post a message', description: 'Send a message to a channel.', write: true }
    ]
  },
  {
    id: 'telegram',
    name: 'Telegram',
    category: 'Messaging',
    auth: 'token',
    note: 'Message @BotFather, create a bot, and paste its token. Start a chat with your bot so it can message you back.',
    setupUrl: 'https://t.me/botfather',
    tokenLabel: 'Bot token',
    actions: [
      { id: 'telegram_updates', label: 'Read messages', description: 'Recent messages sent to the bot.', write: false },
      { id: 'telegram_send', label: 'Send a message', description: 'Send a message to a chat.', write: true }
    ]
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Work',
    auth: 'token',
    note: 'Create an internal integration and share the pages you want Grove to reach with it.',
    setupUrl: 'https://www.notion.so/my-integrations',
    tokenLabel: 'Internal integration secret',
    actions: [
      { id: 'notion_search', label: 'Search', description: 'Search pages and databases.', write: false },
      { id: 'notion_read', label: 'Read a page', description: 'Read a page’s content.', write: false },
      { id: 'notion_query', label: 'Query a database', description: 'Read rows from a Notion database.', write: false },
      { id: 'notion_create', label: 'Create a page', description: 'Add a page under a parent.', write: true },
      { id: 'notion_append', label: 'Append to a page', description: 'Add paragraphs to an existing page.', write: true }
    ]
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'Work',
    auth: 'token',
    note: 'Create a personal API key in Linear settings.',
    setupUrl: 'https://linear.app/settings/api',
    tokenLabel: 'Personal API key',
    actions: [
      { id: 'linear_issues', label: 'List issues', description: 'Your assigned and recent issues.', write: false },
      { id: 'linear_search', label: 'Search issues', description: 'Search issues across your teams.', write: false },
      { id: 'linear_create', label: 'Create an issue', description: 'File a new Linear issue.', write: true },
      { id: 'linear_comment', label: 'Comment', description: 'Comment on an issue.', write: true },
      { id: 'linear_update', label: 'Move an issue', description: 'Change an issue’s state.', write: true }
    ]
  },
  {
    id: 'asana',
    name: 'Asana',
    category: 'Work',
    auth: 'token',
    note: 'Create a personal access token under My Settings → Apps → Developer apps.',
    setupUrl: 'https://app.asana.com/0/my-apps',
    tokenLabel: 'Personal access token',
    actions: [
      { id: 'asana_tasks', label: 'List my tasks', description: 'Incomplete tasks assigned to you.', write: false },
      { id: 'asana_projects', label: 'List projects', description: 'Projects in your workspace.', write: false },
      { id: 'asana_create', label: 'Create a task', description: 'Add a task, optionally to a project.', write: true },
      { id: 'asana_complete', label: 'Complete a task', description: 'Mark a task done.', write: true }
    ]
  },
  {
    id: 'jira',
    name: 'Jira',
    category: 'Work',
    auth: 'token',
    note: 'Create an API token, then paste three values separated by pipes: your site URL, your account email and the token — e.g. https://acme.atlassian.net|me@acme.com|ATATT…',
    setupUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    tokenLabel: 'site | email | API token',
    actions: [
      { id: 'jira_search', label: 'Search issues', description: 'Run a JQL query.', write: false },
      { id: 'jira_read', label: 'Read an issue', description: 'Read one issue in full.', write: false },
      { id: 'jira_create', label: 'Create an issue', description: 'File a new Jira issue.', write: true },
      { id: 'jira_comment', label: 'Comment', description: 'Comment on an issue.', write: true }
    ]
  },
  {
    id: 'todoist',
    name: 'Todoist',
    category: 'Work',
    auth: 'token',
    note: 'Copy your API token from Todoist settings under Integrations → Developer.',
    setupUrl: 'https://app.todoist.com/app/settings/integrations/developer',
    tokenLabel: 'API token',
    actions: [
      { id: 'todoist_list', label: 'List tasks', description: 'Read your active tasks.', write: false },
      { id: 'todoist_create', label: 'Add a task', description: 'Create a task.', write: true },
      { id: 'todoist_close', label: 'Complete a task', description: 'Mark a task done.', write: true }
    ]
  },
  {
    id: 'airtable',
    name: 'Airtable',
    category: 'Files',
    auth: 'token',
    note: 'Create a personal access token with the data.records and schema.bases scopes, and grant it the bases you want reachable.',
    setupUrl: 'https://airtable.com/create/tokens',
    tokenLabel: 'Personal access token',
    actions: [
      { id: 'airtable_bases', label: 'List bases', description: 'Bases and tables the token can reach.', write: false },
      { id: 'airtable_records', label: 'Read records', description: 'Read rows from a table.', write: false },
      { id: 'airtable_create', label: 'Create a record', description: 'Add a row to a table.', write: true }
    ]
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'Dev',
    auth: 'token',
    note: 'Use a fine-grained personal access token scoped to the repositories you want reachable.',
    setupUrl: 'https://github.com/settings/tokens',
    tokenLabel: 'Personal access token',
    actions: [
      { id: 'github_issues', label: 'List issues', description: 'Issues and pull requests assigned to you.', write: false },
      { id: 'github_repo', label: 'Repository activity', description: 'Recent commits and pull requests.', write: false },
      { id: 'github_search', label: 'Search code', description: 'Search code across repositories you can see.', write: false },
      { id: 'github_issue_create', label: 'Open an issue', description: 'Create an issue in a repository.', write: true },
      { id: 'github_comment', label: 'Comment', description: 'Comment on an issue or pull request.', write: true }
    ]
  },
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'Dev',
    auth: 'token',
    note: 'Create an access token in Vercel account settings.',
    setupUrl: 'https://vercel.com/account/tokens',
    tokenLabel: 'Access token',
    actions: [
      { id: 'vercel_projects', label: 'List projects', description: 'Projects on your account or team.', write: false },
      { id: 'vercel_deployments', label: 'Recent deployments', description: 'Deployment history and status.', write: false }
    ]
  },
  {
    id: 'sentry',
    name: 'Sentry',
    category: 'Dev',
    auth: 'token',
    note: 'Create a user auth token with project:read and event:read.',
    setupUrl: 'https://sentry.io/settings/account/api/auth-tokens/',
    tokenLabel: 'Auth token',
    actions: [
      { id: 'sentry_issues', label: 'Unresolved issues', description: 'Errors currently firing in a project.', write: false },
      { id: 'sentry_projects', label: 'List projects', description: 'Projects the token can see.', write: false }
    ]
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Money',
    auth: 'token',
    note: 'Use a restricted key with read access to balance, charges, customers and subscriptions. Grove never needs write access to your payments.',
    setupUrl: 'https://dashboard.stripe.com/apikeys',
    tokenLabel: 'Restricted or secret key',
    actions: [
      { id: 'stripe_balance', label: 'Read balance', description: 'Available and pending balance.', write: false },
      { id: 'stripe_revenue', label: 'Recent revenue', description: 'Charges over a recent window, totalled.', write: false },
      { id: 'stripe_subscriptions', label: 'Subscriptions', description: 'Active subscriptions and recurring revenue.', write: false },
      { id: 'stripe_customers', label: 'Recent customers', description: 'Newest customers on the account.', write: false }
    ]
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'Customers',
    auth: 'token',
    note: 'Create a private app in HubSpot settings and give it the CRM scopes you want Grove to use.',
    setupUrl: 'https://app.hubspot.com/private-apps',
    tokenLabel: 'Private app token',
    actions: [
      { id: 'hubspot_contacts', label: 'List contacts', description: 'Recently updated contacts.', write: false },
      { id: 'hubspot_deals', label: 'List deals', description: 'Open deals and their stages.', write: false },
      { id: 'hubspot_search', label: 'Find a contact', description: 'Search contacts by name or email.', write: false },
      { id: 'hubspot_note', label: 'Log a note', description: 'Attach a note to a contact.', write: true }
    ]
  },
  {
    id: 'calendly',
    name: 'Calendly',
    category: 'Calendar',
    auth: 'token',
    note: 'Create a personal access token in Calendly’s developer settings.',
    setupUrl: 'https://calendly.com/integrations/api_webhooks',
    tokenLabel: 'Personal access token',
    actions: [
      { id: 'calendly_events', label: 'Booked meetings', description: 'Meetings booked through your links.', write: false },
      { id: 'calendly_types', label: 'Event types', description: 'The meeting types you offer.', write: false }
    ]
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    category: 'Social',
    auth: 'oauth',
    note: 'LinkedIn’s API is heavily restricted: you get your own profile and the ability to post. There is no feed reading, no messaging, and no connection data — that access is not granted to general apps.',
    setupUrl: 'https://www.linkedin.com/developers/apps',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    needsSecret: true,
    scopes: ['openid', 'profile', 'w_member_social'],
    actions: [
      { id: 'linkedin_me', label: 'Read your profile', description: 'Your own LinkedIn profile.', write: false },
      { id: 'linkedin_post', label: 'Publish a post', description: 'Post to your LinkedIn feed.', write: true }
    ]
  },
  {
    id: 'x',
    name: 'X',
    category: 'Social',
    auth: 'oauth',
    note: 'Create an app in the X developer portal, enable OAuth 2.0 as a native/public client, and add the loopback redirect Grove shows during connect. Posting requires a paid API tier.',
    setupUrl: 'https://developer.x.com/en/portal/dashboard',
    authUrl: 'https://x.com/i/oauth2/authorize',
    tokenUrl: 'https://api.x.com/2/oauth2/token',
    needsSecret: false,
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    actions: [
      { id: 'x_me', label: 'Read your profile', description: 'Your own account details.', write: false },
      { id: 'x_post', label: 'Post', description: 'Publish a post to your timeline.', write: true }
    ]
  },
  {
    id: 'brave',
    name: 'Brave Search',
    category: 'Research',
    auth: 'token',
    note: 'Gives your agents the live web. Brave’s free tier covers ordinary research use.',
    setupUrl: 'https://api-dashboard.search.brave.com/app/keys',
    tokenLabel: 'Subscription token',
    actions: [
      { id: 'brave_search', label: 'Search the web', description: 'Current results with titles, links and snippets.', write: false },
      { id: 'brave_news', label: 'Search news', description: 'Recent news coverage on a topic.', write: false }
    ]
  }
]

export const connectorFor = (id: string): ConnectorSpec | undefined =>
  CONNECTORS.find((connector) => connector.id === id)

/** Tool id namespace: `provider.action`, so agents can be scoped per provider. */
export const connectorToolId = (providerId: string, actionId: string): string =>
  `${providerId}.${actionId}`

/**
 * Whether one of an agent's grants covers a tool.
 *
 * A grant is an exact tool id, a provider wildcard (`stripe.*`), or `*` for
 * everything. Wildcards are what make a newly connected app usable straight
 * away — without them, connecting Stripe would leave every existing agent
 * blind to it until each action was hand-picked.
 */
export const grantCovers = (grant: string, toolId: string): boolean => {
  if (grant === toolId || grant === '*') return true
  if (!grant.endsWith('.*')) return false
  return toolId.startsWith(grant.slice(0, -1))
}

/** The wildcard that grants every action a provider offers. */
export const providerGrant = (providerId: string): string => `${providerId}.*`
