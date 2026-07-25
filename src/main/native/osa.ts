import { execFile } from 'node:child_process'

/**
 * Runs JavaScript for Automation and parses the JSON it prints.
 *
 * Scripting another app triggers a one-time macOS Automation prompt, and a
 * user who declines leaves us with error -1743. That is a permission problem,
 * not a bug, so it is translated into something actionable rather than raw.
 */
export const osa = <T>(script: string, timeout = 25_000): Promise<T> =>
  new Promise((resolve, reject) => {
    execFile(
      'osascript',
      ['-l', 'JavaScript', '-e', script],
      { timeout, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const message = (stderr || error?.message || '').trim()

        if (error) {
          if (message.includes('-1743') || message.toLowerCase().includes('not authorised') || message.toLowerCase().includes('not authorized')) {
            reject(
              new Error(
                'macOS blocked this. Allow Stobs under System Settings → Privacy & Security → Automation, then try again.'
              )
            )
            return
          }
          if (message.includes('-1728')) {
            reject(new Error('That item no longer exists.'))
            return
          }
          reject(new Error(message || 'AppleScript failed.'))
          return
        }

        const text = stdout.trim()
        if (!text) {
          resolve(undefined as T)
          return
        }
        try {
          resolve(JSON.parse(text) as T)
        } catch {
          resolve(text as unknown as T)
        }
      }
    )
  })

/** Escapes a value for embedding in a generated JXA source string. */
export const lit = (value: unknown): string => JSON.stringify(String(value ?? ''))
