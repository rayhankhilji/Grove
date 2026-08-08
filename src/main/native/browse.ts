import { BrowserWindow, session } from 'electron'

/**
 * A real browser, headless.
 *
 * `fetch` returns whatever the server sends before JavaScript runs, which on
 * most of the modern web is an empty shell. That is why the travel agent could
 * not read a single flight price: Google Flights, Kayak and Booking all render
 * their results client-side, so a fetched page contains the chrome and none of
 * the data.
 *
 * Grove is an Electron app, so it already ships a browser. Rendering the page
 * in an offscreen window and reading the DOM afterwards turns "site blocked me"
 * into live data, with no third-party API and no key.
 */

/** Pages that never finish loading must not hold a turn open forever. */
const LOAD_TIMEOUT = 25_000
const SETTLE = 1_200

export interface Rendered {
  url: string
  title: string
  text: string
}

const partition = 'persist:grove-browse'

/**
 * Reads a page the way a person would see it.
 *
 * The window is never shown and never gets Node — it is a renderer for hostile
 * third-party HTML, so it runs sandboxed with context isolation on, exactly as
 * an untrusted tab should.
 */
export const render = async (url: string): Promise<Rendered> => {
  const view = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      partition,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      javascript: true,
      images: false,
      webSecurity: true
    }
  })

  // A stock Chrome agent string: many sites serve a stripped page to anything
  // that looks automated, which is its own kind of blank result.
  view.webContents.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  )

  try {
    const loaded = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The page took too long to load.')), LOAD_TIMEOUT)
      view.webContents.once('did-finish-load', () => {
        clearTimeout(timer)
        resolve()
      })
      view.webContents.once('did-fail-load', (_event, code, description) => {
        clearTimeout(timer)
        reject(new Error(`${description} (${code})`))
      })
    })

    await view.loadURL(url)
    await loaded
    // Results usually arrive one paint after load, so give the page a beat
    // before reading it. Without this the DOM is real but still empty.
    await new Promise((resolve) => setTimeout(resolve, SETTLE))

    const result = (await view.webContents.executeJavaScript(
      `(() => {
        for (const el of document.querySelectorAll('script,style,noscript,svg,iframe')) el.remove()
        const main = document.querySelector('main,article,[role=main]') || document.body
        return {
          url: location.href,
          title: document.title || '',
          text: (main.innerText || '').replace(/\\n{3,}/g, '\\n\\n').trim()
        }
      })()`
    )) as Rendered

    return result
  } finally {
    if (!view.isDestroyed()) view.destroy()
  }
}

/** Drops cookies and cache picked up while browsing. */
export const forgetBrowsing = async (): Promise<void> => {
  await session.fromPartition(partition).clearStorageData()
}
