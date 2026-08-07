import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { AppState, KeyStatus } from '@shared/types'
import { api } from './api'

interface Store {
  state: AppState
  keyStatus: KeyStatus
  /** Replaces local state with whatever the main process just returned. */
  apply: (next: AppState) => void
  setKeyStatus: (next: KeyStatus) => void
  reload: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)

export const StoreProvider = ({ children }: { children: ReactNode }): ReactNode => {
  const [state, setState] = useState<AppState | null>(null)
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null)

  const reload = useCallback(async () => {
    const [next, key] = await Promise.all([api.getState(), api.keyStatus()])
    setState(next)
    setKeyStatus(key)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const value = useMemo<Store | null>(
    () =>
      state && keyStatus
        ? { state, keyStatus, apply: setState, setKeyStatus, reload }
        : null,
    [state, keyStatus, reload]
  )

  if (!value) return null
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useStore = (): Store => {
  const store = useContext(Ctx)
  if (!store) throw new Error('useStore must be used inside StoreProvider')
  return store
}
