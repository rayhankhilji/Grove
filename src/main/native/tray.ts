import { app, BrowserWindow, globalShortcut, Menu, nativeImage, Notification, Tray } from 'electron'
import { deflateSync } from 'node:zlib'
import type { Run } from '@shared/types'
import { store } from '../store'

/* ── Tray icon ───────────────────────────────────────────────────────────── */

const crcTable = ((): number[] => {
  const table: number[] = []
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (buffer: Buffer): number => {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const chunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/**
 * The Grove mark, drawn as a template PNG at runtime.
 *
 * Building it in code rather than shipping a binary asset keeps the icon in
 * step with the rest of the icon set, and template images let macOS invert it
 * automatically for light and dark menu bars.
 */
const trayIcon = (): Electron.NativeImage => {
  const size = 32
  const raw = Buffer.alloc(size * (size * 4 + 1))
  const centre = (size - 1) / 2

  let cursor = 0
  for (let y = 0; y < size; y += 1) {
    raw[cursor] = 0 // no per-scanline filter
    cursor += 1
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - centre, y - centre)
      // An open orbit with a solid core — the same mark as the in-app logo.
      const ring = Math.max(0, 1 - Math.abs(distance - 12.5) / 2.2)
      const gap = x > centre && y < centre && distance > 9 ? 0 : 1
      const core = Math.max(0, 1 - Math.max(0, distance - 4.4) / 1.6)
      const alpha = Math.min(1, Math.max(ring * gap, core))
      raw[cursor + 3] = Math.round(alpha * 255)
      cursor += 4
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])

  const image = nativeImage.createFromBuffer(png, { scaleFactor: 2 })
  image.setTemplateImage(true)
  return image
}

/* ── Menu bar ────────────────────────────────────────────────────────────── */

let tray: Tray | null = null

const show = (): void => {
  const [window] = BrowserWindow.getAllWindows()
  if (window) {
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }
  app.dock?.show()
}

/** Asks the renderer to move to a view — used by the hotkey and tray items. */
const go = (view: string): void => {
  show()
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('navigate', view)
  }
}

export const refreshTray = (): void => {
  if (!tray) return
  const state = store.get()
  const running = state.runs.filter((run) => run.status === 'running').length
  const waiting = state.runs.filter((run) => run.status === 'awaiting_approval')
  const openTasks = state.tasks.filter((task) => !task.done).length

  tray.setToolTip(
    running > 0 ? `Grove — ${running} agent${running === 1 ? '' : 's'} working` : 'Grove'
  )
  // A short title beside the icon is the least intrusive way to show life.
  tray.setTitle(waiting.length > 0 ? ` ${waiting.length}!` : running > 0 ? ` ${running}` : '')

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: running > 0 ? `${running} running` : 'Idle', enabled: false },
      ...(waiting.length > 0
        ? [
            { type: 'separator' as const },
            { label: 'Waiting on you', enabled: false },
            ...waiting.map((run) => ({
              label: `  ${run.agentName}: ${run.pending?.toolName ?? 'approval'}`,
              click: () => go('agents')
            }))
          ]
        : []),
      { type: 'separator' },
      { label: `Home · ${openTasks} open task${openTasks === 1 ? '' : 's'}`, click: () => go('home') },
      { label: 'Ask Grove…', accelerator: 'Alt+Space', click: () => go('chat') },
      { label: 'Agents', click: () => go('agents') },
      { label: 'Knowledge', click: () => go('knowledge') },
      { type: 'separator' },
      {
        label: 'Automations',
        type: 'checkbox',
        checked: state.settings.automationsEnabled,
        click: () => {
          store.update((draft) => {
            draft.settings.automationsEnabled = !draft.settings.automationsEnabled
          })
          refreshTray()
        }
      },
      {
        label: 'Track attention',
        type: 'checkbox',
        checked: state.settings.attentionEnabled,
        click: () => {
          store.update((draft) => {
            draft.settings.attentionEnabled = !draft.settings.attentionEnabled
          })
          refreshTray()
        }
      },
      { type: 'separator' },
      { label: 'Open Grove', click: show },
      { label: 'Quit Grove', role: 'quit' }
    ])
  )
}

export const startTray = (): void => {
  if (tray || !store.get().settings.menuBarEnabled) return
  tray = new Tray(trayIcon())
  tray.on('click', () => tray?.popUpContextMenu())
  refreshTray()
}

export const stopTray = (): void => {
  tray?.destroy()
  tray = null
}

export const syncTray = (): void => {
  if (store.get().settings.menuBarEnabled) {
    if (!tray) startTray()
    else refreshTray()
  } else {
    stopTray()
  }
}

/* ── Global hotkey ───────────────────────────────────────────────────────── */

export const registerHotkey = (): string | null => {
  // ⌥Space first; if something already owns it, fall back to ⌃⌥S.
  for (const accelerator of ['Alt+Space', 'Control+Alt+S']) {
    if (globalShortcut.register(accelerator, () => go('chat'))) return accelerator
  }
  return null
}

export const releaseHotkey = (): void => globalShortcut.unregisterAll()

/* ── Notifications ───────────────────────────────────────────────────────── */

export const notifyRun = (run: Run): void => {
  if (!Notification.isSupported()) return

  if (run.status === 'awaiting_approval' && run.pending) {
    new Notification({
      title: `${run.agentName} needs approval`,
      body: run.pending.summary.split('\n')[0] ?? run.pending.toolName,
      silent: false
    })
      .on('click', () => go('agents'))
      .show()
    return
  }

  // Only surface finished background work — chat replies are already visible.
  if (run.status === 'succeeded' && run.trigger !== 'chat' && run.trigger !== 'handoff') {
    new Notification({
      title: `${run.agentName} finished`,
      body: run.output.slice(0, 160) || 'Done.',
      silent: true
    })
      .on('click', () => go('agents'))
      .show()
  }
}
