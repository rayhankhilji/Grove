import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { KeyStatus } from '@shared/types'

export interface ProviderCredentials {
  /** OAuth app identity, supplied by the user — desktop apps can't ship one. */
  clientId?: string
  clientSecret?: string
  /** Live credentials. */
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  account?: string
}

interface VaultData {
  anthropicKey?: string
  providers: Record<string, ProviderCredentials>
}

/**
 * Every secret Grove holds, in one encrypted file.
 *
 * safeStorage derives its key from the macOS Keychain. If encryption is
 * unavailable the vault stays in memory for the session — a plaintext secret
 * is never written to disk as a fallback.
 */
class Vault {
  private file = ''
  private data: VaultData = { providers: {} }

  init(): void {
    this.file = join(app.getPath('userData'), 'vault.enc')
    this.data = this.read()
  }

  private read(): VaultData {
    if (!existsSync(this.file) || !safeStorage.isEncryptionAvailable()) return { providers: {} }
    try {
      const raw = safeStorage.decryptString(Buffer.from(readFileSync(this.file, 'utf8'), 'base64'))
      const parsed = JSON.parse(raw) as Partial<VaultData>
      return { anthropicKey: parsed.anthropicKey, providers: parsed.providers ?? {} }
    } catch {
      return { providers: {} }
    }
  }

  private persist(): void {
    if (!safeStorage.isEncryptionAvailable()) return
    writeFileSync(
      this.file,
      safeStorage.encryptString(JSON.stringify(this.data)).toString('base64'),
      'utf8'
    )
  }

  /* ── Anthropic key ─────────────────────────────────────────────────── */

  getKey(): string | null {
    return this.data.anthropicKey ?? null
  }

  setKey(key: string): KeyStatus {
    const trimmed = key.trim()
    if (!trimmed) return this.clearKey()
    this.data.anthropicKey = trimmed
    this.persist()
    return this.keyStatus()
  }

  clearKey(): KeyStatus {
    delete this.data.anthropicKey
    this.persist()
    return this.keyStatus()
  }

  keyStatus(): KeyStatus {
    const key = this.data.anthropicKey
    return {
      configured: Boolean(key),
      hint: key ? key.slice(-4) : null,
      encrypted: safeStorage.isEncryptionAvailable()
    }
  }

  /* ── Provider credentials ──────────────────────────────────────────── */

  provider(id: string): ProviderCredentials {
    return this.data.providers[id] ?? {}
  }

  saveProvider(id: string, patch: ProviderCredentials): void {
    this.data.providers[id] = { ...this.provider(id), ...patch }
    this.persist()
  }

  /** Drops live tokens but keeps the OAuth app config, so reconnecting is one click. */
  disconnectProvider(id: string): void {
    const { clientId, clientSecret } = this.provider(id)
    this.data.providers[id] = { clientId, clientSecret }
    this.persist()
  }

  forgetProvider(id: string): void {
    delete this.data.providers[id]
    this.persist()
  }

  destroy(): void {
    this.data = { providers: {} }
    if (existsSync(this.file)) rmSync(this.file)
  }
}

export const vault = new Vault()
