import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Batch, Item } from './types'

const ITEMS_KEY = 'barkat.items'
const BATCHES_KEY = 'barkat.batches'

function cached<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

/** Menu items and open batches, cached so Sell works offline. */
export function useShop() {
  const [items, setItems] = useState<Item[]>(() => cached(ITEMS_KEY, []))
  const [openBatches, setOpenBatches] = useState<Batch[]>(() => cached(BATCHES_KEY, []))

  const refresh = useCallback(async () => {
    const [i, b] = await Promise.all([
      supabase.from('items').select('*').eq('active', true).order('sort'),
      supabase.from('batches').select('*').is('closed_at', null).order('started_at'),
    ])
    if (!i.error && i.data) {
      setItems(i.data as Item[])
      save(ITEMS_KEY, i.data)
    }
    if (!b.error && b.data) {
      setOpenBatches(b.data as Batch[])
      save(BATCHES_KEY, b.data)
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh()
    // Another phone may have changed the menu or started a container while this one was in a pocket.
    const onVisible = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  return { items, openBatches, refresh }
}
