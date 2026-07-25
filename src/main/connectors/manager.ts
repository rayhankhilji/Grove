import type { AppState, Connection } from '@shared/types'
import { CONNECTORS, connectorFor } from '@shared/connectors'
import { identify } from './clients'
import { connect as oauthConnect } from './oauth'
import { vault } from '../vault'
import { now, store } from '../store'

/** Derives the connection list from the vault, so UI state can never drift. */
export const syncConnections = (): AppState => {
  const existing = new Map(store.get().connections.map((entry) => [entry.providerId, entry]))

  const connections: Connection[] = CONNECTORS.map((spec) => {
    const creds = vault.provider(spec.id)
    const previous = existing.get(spec.id)
    const live = Boolean(creds.accessToken)

    return {
      providerId: spec.id,
      status: live ? 'connected' : previous?.status === 'error' && !live ? 'error' : 'disconnected',
      account: live ? creds.account ?? previous?.account ?? null : null,
      connectedAt: live ? previous?.connectedAt ?? now() : null,
      expiresAt: creds.expiresAt ? new Date(creds.expiresAt).toISOString() : null,
      error: live ? null : previous?.error ?? null,
      configured: spec.auth === 'token' ? true : Boolean(creds.clientId)
    }
  })

  return store.update((state) => {
    state.connections = connections
  })
}

const markError = (providerId: string, message: string): AppState => {
  syncConnections()
  return store.update((state) => {
    const connection = state.connections.find((entry) => entry.providerId === providerId)
    if (connection) {
      connection.status = 'error'
      connection.error = message
    }
  })
}

/** Records who the credential belongs to, so the UI can show the real account. */
const attachIdentity = async (providerId: string): Promise<void> => {
  try {
    const account = await identify(providerId)
    vault.saveProvider(providerId, { account })
  } catch {
    // A working token with an unreadable identity endpoint is still connected.
    vault.saveProvider(providerId, { account: 'Connected' })
  }
}

export const saveOAuthApp = (
  providerId: string,
  clientId: string,
  clientSecret: string
): AppState => {
  vault.saveProvider(providerId, {
    clientId: clientId.trim() || undefined,
    clientSecret: clientSecret.trim() || undefined
  })
  return syncConnections()
}

export const connectProvider = async (providerId: string): Promise<AppState> => {
  const spec = connectorFor(providerId)
  if (!spec) return store.get()

  try {
    if (spec.auth === 'oauth') await oauthConnect(providerId)
    await attachIdentity(providerId)
    const state = syncConnections()
    return store.update(() => {
      const connection = state.connections.find((entry) => entry.providerId === providerId)
      if (connection) connection.connectedAt = now()
    })
  } catch (error) {
    return markError(providerId, (error as Error).message)
  }
}

/** Token providers skip OAuth entirely — the user pastes a personal token. */
export const connectWithToken = async (providerId: string, token: string): Promise<AppState> => {
  const trimmed = token.trim()
  if (!trimmed) return syncConnections()

  vault.saveProvider(providerId, { accessToken: trimmed })
  try {
    const account = await identify(providerId)
    vault.saveProvider(providerId, { account })
    const state = syncConnections()
    return store.update(() => {
      const connection = state.connections.find((entry) => entry.providerId === providerId)
      if (connection) connection.connectedAt = now()
    })
  } catch (error) {
    // A token that cannot even identify itself is not a working connection.
    vault.disconnectProvider(providerId)
    return markError(providerId, (error as Error).message)
  }
}

export const disconnectProvider = (providerId: string): AppState => {
  vault.disconnectProvider(providerId)
  return syncConnections()
}
