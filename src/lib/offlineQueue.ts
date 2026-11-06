import { supabase } from './supabase'
import type { FailedSale, PendingSale } from './types'

const PENDING_KEY = 'barkat.pendingSales'
const FAILED_KEY = 'barkat.failedSales'

function read<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: queue only lives in memory this session */
  }
}

export interface QueueState {
  pending: number
  failed: FailedSale[]
  syncing: boolean
  lastError: string | null
}

let state: QueueState = { pending: read<PendingSale>(PENDING_KEY).length, failed: read<FailedSale>(FAILED_KEY), syncing: false, lastError: null }
const listeners = new Set<() => void>()
function update(patch: Partial<QueueState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

// For useSyncExternalStore
export const subscribeQueue = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
export const getQueueState = () => state

export const getPending = () => read<PendingSale>(PENDING_KEY)
const setPending = (list: PendingSale[]) => {
  write(PENDING_KEY, list)
  update({ pending: list.length })
}
const setFailed = (list: FailedSale[]) => {
  write(FAILED_KEY, list)
  update({ failed: list })
}

/** Postgres data/integrity errors (22xxx, 23xxx) will never succeed on retry. Everything else (offline, expired login, paused project) might. */
const isPermanent = (e: { code?: string }) => /^(22|23)/.test(e.code ?? '')

async function send(sale: PendingSale) {
  return supabase.rpc('record_sale', { p: sale })
}

let flushing = false
export async function flush() {
  if (flushing) return
  flushing = true
  update({ syncing: true })
  try {
    for (const sale of getPending()) {
      const { error } = await send(sale)
      if (!error) {
        setPending(getPending().filter((s) => s.id !== sale.id))
      } else if (isPermanent(error)) {
        setPending(getPending().filter((s) => s.id !== sale.id))
        setFailed([...state.failed, { sale, error: error.message }])
      } else {
        update({ lastError: error.message })
        return // offline or temporary problem: keep order and try again later
      }
    }
    update({ lastError: null })
  } finally {
    flushing = false
    update({ syncing: false })
  }
}

export async function submitSale(sale: PendingSale) {
  setPending([...getPending(), sale])
  await flush()
}

export function retryFailed(id: string) {
  const item = state.failed.find((f) => f.sale.id === id)
  if (!item) return
  setFailed(state.failed.filter((f) => f.sale.id !== id))
  setPending([...getPending(), item.sale])
  void flush()
}

export function discardFailed(id: string) {
  setFailed(state.failed.filter((f) => f.sale.id !== id))
}

/** Void (or restore) a bill. A bill that never reached the server is simply dropped. */
export async function setVoided(id: string, voided: boolean) {
  if (voided) {
    const pending = getPending()
    if (pending.some((s) => s.id === id)) {
      setPending(pending.filter((s) => s.id !== id))
      return
    }
  }
  const { error } = await supabase.rpc('set_sale_voided', { p_id: id, p_voided: voided })
  if (error) throw new Error(error.message)
}

window.addEventListener('online', () => void flush())
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void flush()
})
setInterval(() => void flush(), 30_000)
