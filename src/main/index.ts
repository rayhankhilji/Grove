import { app, BrowserWindow, nativeTheme, shell } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { syncConnections } from './connectors/manager'
import { onRunUpdate } from './agents/runtime'
import { startAttention, stopAttention } from './native/context'
import { notifyRun, refreshTray, registerHotkey, releaseHotkey, startTray, stopTray } from './native/tray'
import { startScheduler, stopScheduler } from './workflows'
import { vault } from './vault'
import { store } from './store'

const isDev = !app.isPackaged

const createWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 980,
    minHeight: 660,
    show: false,
    title: 'Stobs',
    // Translucent chrome that picks up the desktop behind it — the app should
    // feel like part of macOS, not a browser tab.
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 19, y: 22 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.once('ready-to-show', () => window.show())

  // Keep navigation inside the app; anything external opens in the browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event) => event.preventDefault())

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) void window.loadURL(devUrl)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))

  return window
}

app.whenReady().then(() => {
  store.init()
  vault.init()
  syncConnections()

  const theme = store.get().settings.theme
  nativeTheme.themeSource = theme === 'system' ? 'system' : theme

  registerIpc()
  createWindow()

  startScheduler()
  startAttention()
  startTray()
  registerHotkey()

  // The menu bar mirrors run state, and finished background work is announced.
  onRunUpdate((run) => {
    refreshTray()
    notifyRun(run)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else BrowserWindow.getAllWindows()[0]?.show()
  })
})

// With a menu bar presence, closing the window should not end the session.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopScheduler()
  stopAttention()
  releaseHotkey()
  stopTray()
  store.flush()
})
