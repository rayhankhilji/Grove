import type { GroveApi } from '../../preload'

declare global {
  interface Window {
    grove: GroveApi
  }
}

export const api = window.grove
