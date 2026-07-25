import type { StobsApi } from '../../preload'

declare global {
  interface Window {
    stobs: StobsApi
  }
}

export const api = window.stobs
