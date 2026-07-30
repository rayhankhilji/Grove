/** Minimal Electron surface so main-process modules can run under plain Node. */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'grove-verify-'))

export const app = {
  getPath: (): string => dir,
  isPackaged: false,
  whenReady: async (): Promise<void> => undefined,
  on: (): void => undefined
}

export const safeStorage = {
  isEncryptionAvailable: (): boolean => false,
  encryptString: (value: string): Buffer => Buffer.from(value, 'utf8'),
  decryptString: (value: Buffer): string => value.toString('utf8')
}

export const shell = { openExternal: async (): Promise<void> => undefined }
export const ipcMain = { handle: (): void => undefined }
export const nativeTheme = { themeSource: 'dark' }
export const BrowserWindow = { getAllWindows: (): unknown[] => [] }
