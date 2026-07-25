import { shell } from 'electron'
import { createHash, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { connectorFor } from '@shared/connectors'
import { vault } from '../vault'

/**
 * A fixed loopback port, because most providers require an exact redirect URI
 * to be registered up front. The Connections screen shows this string so it can
 * be pasted verbatim into the provider's console.
 */
export const REDIRECT_PORT = 8721
export const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`

const base64url = (input: Buffer): string =>
  input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const CLOSE_PAGE = (title: string, detail: string): string => `<!doctype html>
<meta charset="utf-8"><title>Stobs</title>
<style>
  body{font:15px -apple-system,sans-serif;background:#0d0e10;color:#e9eaec;
       height:100vh;margin:0;display:grid;place-items:center;text-align:center}
  .c{max-width:340px}h1{font-size:17px;margin:0 0 8px}p{color:#9aa1ab;font-size:13px;line-height:1.5}
  .d{width:38px;height:38px;border-radius:12px;background:rgba(78,197,182,.16);
     color:#4ec5b6;display:grid;place-items:center;margin:0 auto 14px;font-size:19px}
</style>
<div class="c"><div class="d">●</div><h1>${title}</h1><p>${detail}</p></div>`

/** Waits for the provider to redirect back with an authorisation code. */
const awaitCallback = (expectedState: string): Promise<string> =>
  new Promise((resolve, reject) => {
    let server: Server

    const finish = (fn: () => void): void => {
      setTimeout(() => server.close(), 200)
      fn()
    }

    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', REDIRECT_URI)
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }

      const error = url.searchParams.get('error')
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })

      if (error) {
        res.end(CLOSE_PAGE('Connection cancelled', `The provider reported: ${error}`))
        finish(() => reject(new Error(`Authorisation failed: ${error}`)))
      } else if (!code) {
        res.end(CLOSE_PAGE('Something went wrong', 'No authorisation code came back.'))
        finish(() => reject(new Error('No authorisation code returned.')))
      } else if (state !== expectedState) {
        // Guards against a forged callback from another page in the browser.
        res.end(CLOSE_PAGE('Something went wrong', 'The security check did not match.'))
        finish(() => reject(new Error('State mismatch — authorisation rejected.')))
      } else {
        res.end(CLOSE_PAGE('Connected', 'You can close this tab and return to Stobs.'))
        finish(() => resolve(code))
      }
    })

    server.on('error', (cause: NodeJS.ErrnoException) => {
      reject(
        cause.code === 'EADDRINUSE'
          ? new Error(`Port ${REDIRECT_PORT} is already in use. Close whatever is using it and try again.`)
          : cause
      )
    })

    server.listen(REDIRECT_PORT, '127.0.0.1')

    setTimeout(() => {
      finish(() => reject(new Error('Timed out waiting for authorisation.')))
    }, 300_000)
  })

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  authed_user?: { access_token?: string; refresh_token?: string; expires_in?: number }
  error?: string
  error_description?: string
  ok?: boolean
}

/** Slack returns the user token nested; everyone else uses the standard shape. */
const readTokens = (
  providerId: string,
  body: TokenResponse
): { accessToken: string; refreshToken?: string; expiresIn?: number } => {
  if (providerId === 'slack') {
    const user = body.authed_user ?? {}
    if (!user.access_token) throw new Error(body.error ?? 'Slack did not return a user token.')
    return {
      accessToken: user.access_token,
      refreshToken: user.refresh_token,
      expiresIn: user.expires_in
    }
  }
  if (!body.access_token) {
    throw new Error(body.error_description ?? body.error ?? 'No access token returned.')
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in
  }
}

const exchange = async (providerId: string, params: URLSearchParams): Promise<void> => {
  const spec = connectorFor(providerId)
  if (!spec?.tokenUrl) throw new Error('Unknown provider.')

  const response = await fetch(spec.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: params
  })

  const body = (await response.json()) as TokenResponse
  if (!response.ok && !body.access_token && !body.authed_user) {
    throw new Error(body.error_description ?? body.error ?? `Token exchange failed (${response.status}).`)
  }

  const { accessToken, refreshToken, expiresIn } = readTokens(providerId, body)
  vault.saveProvider(providerId, {
    accessToken,
    // Providers that rotate refresh tokens send a new one; those that don't
    // omit it, and the existing one must survive.
    ...(refreshToken ? { refreshToken } : {}),
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined
  })
}

export const connect = async (providerId: string): Promise<void> => {
  const spec = connectorFor(providerId)
  if (!spec || spec.auth !== 'oauth' || !spec.authUrl) throw new Error('Provider does not use OAuth.')

  const creds = vault.provider(providerId)
  if (!creds.clientId) throw new Error(`Add your ${spec.name} client ID first.`)
  if (spec.needsSecret && !creds.clientSecret) {
    throw new Error(`${spec.name} also requires a client secret.`)
  }

  const verifier = base64url(randomBytes(48))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  const state = base64url(randomBytes(16))

  const auth = new URL(spec.authUrl)
  auth.searchParams.set('client_id', creds.clientId)
  auth.searchParams.set('redirect_uri', REDIRECT_URI)
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('state', state)
  auth.searchParams.set('code_challenge', challenge)
  auth.searchParams.set('code_challenge_method', 'S256')

  const scopes = (spec.scopes ?? []).join(providerId === 'slack' ? ',' : ' ')
  // Slack scopes user-level grants through `user_scope`, not `scope`.
  auth.searchParams.set(providerId === 'slack' ? 'user_scope' : 'scope', scopes)

  if (providerId === 'google') {
    // Without these Google withholds the refresh token on repeat consent.
    auth.searchParams.set('access_type', 'offline')
    auth.searchParams.set('prompt', 'consent')
  }

  const waiting = awaitCallback(state)
  await shell.openExternal(auth.toString())
  const code = await waiting

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: creds.clientId,
    code_verifier: verifier
  })
  if (creds.clientSecret) params.set('client_secret', creds.clientSecret)

  await exchange(providerId, params)
}

/** Refreshes an expiring token. No-op for providers that issue long-lived ones. */
export const refresh = async (providerId: string): Promise<void> => {
  const creds = vault.provider(providerId)
  if (!creds.refreshToken || !creds.clientId) return

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: creds.refreshToken,
    client_id: creds.clientId
  })
  if (creds.clientSecret) params.set('client_secret', creds.clientSecret)

  await exchange(providerId, params)
}

/**
 * Returns a usable access token, refreshing first when it is within a minute
 * of expiry so a long agent run never dies mid-flight.
 */
export const accessToken = async (providerId: string): Promise<string> => {
  const spec = connectorFor(providerId)
  const creds = vault.provider(providerId)

  if (spec?.auth === 'token') {
    if (!creds.accessToken) throw new Error(`${spec.name} is not connected.`)
    return creds.accessToken
  }

  if (!creds.accessToken) throw new Error(`${spec?.name ?? providerId} is not connected.`)
  if (creds.expiresAt && creds.expiresAt - Date.now() < 60_000 && creds.refreshToken) {
    await refresh(providerId)
    return vault.provider(providerId).accessToken ?? creds.accessToken
  }
  return creds.accessToken
}
