import type { ConnectorSpec } from './types'

/**
 * The connector catalogue.
 *
 * Every entry points at a provider's real authorisation and token endpoints.
 * OAuth providers need a client id you create yourself — desktop apps cannot
 * ship a shared one safely — and a few still require a client secret at the
 * token endpoint, which is why `needsSecret` exists. Providers whose OAuth is
 * closed to desktop clients use a personal access token instead, which is the
 * supported path rather than a workaround.
 */
export const CONNECTORS: ConnectorSpec[] = [
  {
    id: 'google',
    name: 'Gmail & Google Calendar',
    category: 'Email',
    auth: 'oauth',
    note: 'Create an OAuth client of type “Desktop app”. Google issues a client secret for desktop clients and documents it as non-confidential.',
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    needsSecret: true,
    scopes: [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    actions: [
      { id: 'gmail_search', label: 'Search mail', description: 'Find messages with Gmail query syntax.', write: false },
      { id: 'gmail_read', label: 'Read a message', description: 'Read the full body of one message.', write: false },
      { id: 'gmail_send', label: 'Send mail', description: 'Send an email from your account.', write: true },
      { id: 'gmail_draft', label: 'Draft mail', description: 'Save a draft without sending.', write: true },
      { id: 'gcal_list', label: 'List events', description: 'Read calendar events in a window.', write: false },
      { id: 'gcal_create', label: 'Create event', description: 'Put a new event on your calendar.', write: true }
    ]
  },
  {
    id: 'microsoft',
    name: 'Outlook & Microsoft 365',
    category: 'Email',
    auth: 'oauth',
    note: 'Register an app in Entra ID as a public client with redirect “http://localhost”. No client secret needed — Microsoft supports PKCE properly.',
    setupUrl: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    needsSecret: false,
    scopes: [
      'offline_access',
      'User.Read',
      'Mail.ReadWrite',
      'Mail.Send',
      'Calendars.ReadWrite'
    ],
    actions: [
      { id: 'outlook_search', label: 'Search mail', description: 'Search your Outlook mailbox.', write: false },
      { id: 'outlook_read', label: 'Read a message', description: 'Read one message in full.', write: false },
      { id: 'outlook_send', label: 'Send mail', description: 'Send an email from Outlook.', write: true },
      { id: 'mscal_list', label: 'List events', description: 'Read Outlook calendar events.', write: false },
      { id: 'mscal_create', label: 'Create event', description: 'Add an event to Outlook calendar.', write: true }
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
      { id: 'slack_post', label: 'Post a message', description: 'Send a message as you.', write: true }
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
      { id: 'notion_create', label: 'Create a page', description: 'Add a page under a parent.', write: true }
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
      { id: 'linear_create', label: 'Create an issue', description: 'File a new Linear issue.', write: true },
      { id: 'linear_comment', label: 'Comment', description: 'Comment on an issue.', write: true }
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
      { id: 'github_issue_create', label: 'Open an issue', description: 'Create an issue in a repository.', write: true }
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
  }
]

export const connectorFor = (id: string): ConnectorSpec | undefined =>
  CONNECTORS.find((connector) => connector.id === id)

/** Tool id namespace: `provider.action`, so agents can be scoped per provider. */
export const connectorToolId = (providerId: string, actionId: string): string =>
  `${providerId}.${actionId}`
