import { useEffect, useState } from 'react'
import Sheet from '../components/Sheet'
import { useUI } from '../components/ui-context'
import { setVoided, submitSale } from '../lib/offlineQueue'
import { rupees } from '../lib/money'
import { canonicalName, fetchUdhaar, people } from '../lib/stats'
import { uuid } from '../lib/uuid'
import type { Batch, Item, PendingSale, Payment, SaleLine } from '../lib/types'

interface Props {
  items: Item[]
  openBatches: Batch[]
}

const CART_KEY = 'barkat.cart'
interface Saved {
  cart: Record<number, number>
  prices: Record<number, number>
  note: string
}
function loadCart(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(CART_KEY) ?? 'null') as Saved | null
    if (v && typeof v === 'object') return { cart: v.cart ?? {}, prices: v.prices ?? {}, note: v.note ?? '' }
  } catch {
    /* ignore */
  }
  return { cart: {}, prices: {}, note: '' }
}

export default function Sell({ items, openBatches }: Props) {
  const ui = useUI()
  const [saved] = useState(loadCart)
  const [cart, setCart] = useState(saved.cart)
  const [prices, setPrices] = useState(saved.prices) // per-item price overrides
  const [note, setNote] = useState(saved.note)
  const [editing, setEditing] = useState<Item | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [askUdhaar, setAskUdhaar] = useState(false)
  const [person, setPerson] = useState('')
  const [names, setNames] = useState<string[]>([])
  const [toast, setToast] = useState<{ id: string; total: number } | null>(null)

  // An unfinished order survives a reload or switching apps.
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify({ cart, prices, note }))
    } catch {
      /* ignore */
    }
  }, [cart, prices, note])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  const byId = new Map(items.map((i) => [i.id, i]))
  const priceOf = (id: number) => prices[id] ?? byId.get(id)?.price ?? 0
  const entries = Object.entries(cart)
    .map(([id, q]) => [Number(id), q] as const)
    .filter(([id, q]) => q > 0 && byId.has(id))
  const total = entries.reduce((s, [id, q]) => s + priceOf(id) * q, 0)
  const discounted = entries.some(([id]) => priceOf(id) < (byId.get(id)?.price ?? 0))
  const count = entries.reduce((s, [, q]) => s + q, 0)

  const add = (id: number, d: number) =>
    setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }))

  function reset() {
    setCart({})
    setPrices({})
    setNote('')
  }

  function openEditor(it: Item) {
    setEditing(it)
    setEditPrice(String(priceOf(it.id)))
  }

  function saveEditor(value?: number) {
    if (!editing) return
    const p = value ?? parseInt(editPrice)
    if (Number.isNaN(p) || p < 0) return
    setPrices((m) => {
      const next = { ...m }
      if (p === editing.price) delete next[editing.id]
      else next[editing.id] = p
      return next
    })
    setEditing(null)
  }

  async function checkout(payment: Payment, who?: string) {
    if (!entries.length) return
    const lines: SaleLine[] = entries.map(([id, qty]) => {
      const item = byId.get(id)!
      const batch = item.batch_type === 'none' ? null : openBatches.find((b) => b.type === item.batch_type)
      return { item_id: id, qty, unit_price: priceOf(id), list_price: item.price, batch_id: batch?.id ?? null }
    })
    const sale: PendingSale = {
      id: uuid(),
      // Runs in a click handler, not during render.
      // oxlint-disable-next-line react/purity
      created_at: new Date().toISOString(),
      payment,
      total,
      note: discounted && note.trim() ? note.trim() : undefined,
      person: who,
      lines,
    }
    reset()
    setAskUdhaar(false)
    setToast({ id: sale.id, total })
    if (navigator.vibrate) navigator.vibrate(30)
    await submitSale(sale)
  }

  async function openUdhaar() {
    setPerson('')
    setAskUdhaar(true)
    try {
      setNames(people(await fetchUdhaar()).map((p) => p.name))
    } catch {
      /* offline: typing a name still works */
    }
  }

  async function undo() {
    if (!toast) return
    const id = toast.id
    setToast(null)
    try {
      await setVoided(id, true)
      ui.toast('Sale undone')
    } catch {
      ui.toast('Could not undo. Void it from the Bills tab.', 'error')
    }
  }

  const noBatch = entries.some(([id]) => {
    const t = byId.get(id)?.batch_type
    return t && t !== 'none' && !openBatches.some((b) => b.type === t)
  })

  return (
    <div className="flex h-full flex-col">
      <div className="grid flex-1 grid-cols-2 content-start gap-3 overflow-y-auto p-3">
        {!items.length && <p className="col-span-2 py-8 text-center text-stone-500">Loading menu…</p>}
        {items.map((it) => {
          const q = cart[it.id] ?? 0
          const price = priceOf(it.id)
          return (
            <div key={it.id} className="relative">
              <button
                onClick={() => add(it.id, 1)}
                className={`flex h-24 w-full flex-col items-center justify-center rounded-2xl border-2 text-center active:scale-95 ${
                  q ? 'border-brand bg-amber-100' : 'border-amber-200 bg-white'
                }`}
              >
                <span className="text-lg font-semibold">{it.name}</span>
                <span className="text-brand">
                  {price !== it.price && <s className="mr-1 text-stone-500">{rupees(it.price)}</s>}
                  {price === 0 ? 'Free' : rupees(price)}
                </span>
              </button>
              {q > 0 && (
                <div className="absolute -right-1 -top-3 flex items-center rounded-full bg-brand text-white shadow">
                  <button className="h-11 w-11 text-2xl" onClick={() => add(it.id, -1)} aria-label={`Remove one ${it.name}`}>−</button>
                  <button className="h-11 min-w-8 pr-3 text-center text-lg font-bold underline decoration-dotted" onClick={() => openEditor(it)} aria-label={`${q} ${it.name}. Change price`}>
                    {q}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {toast && (
        <div className="mx-3 mb-2 flex items-center justify-between rounded-xl bg-cash px-4 py-2 text-white" role="status">
          <span>Saved {rupees(toast.total)}</span>
          <button onClick={undo} className="min-h-11 px-2 font-semibold underline">Undo</button>
        </div>
      )}

      <div className="border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {noBatch && <p className="mb-1 text-xs text-orange-800">No open container. Start one in Batches.</p>}
        {discounted && (
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Discount / free for? (optional)"
            aria-label="Reason for discount" className="mb-2 w-full rounded-lg border p-2 text-sm" />
        )}
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-stone-600">{count} item{count === 1 ? '' : 's'}{discounted && ' · discount'}</span>
          <span className="text-3xl font-bold">{rupees(total)}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button disabled={!entries.length} onClick={() => checkout('cash')}
            className="h-14 rounded-xl bg-cash text-lg font-bold text-white disabled:opacity-40">Cash</button>
          <button disabled={!entries.length} onClick={() => checkout('online')}
            className="h-14 rounded-xl bg-online text-lg font-bold text-white disabled:opacity-40">Online</button>
          <button disabled={!total} onClick={openUdhaar}
            className="h-14 rounded-xl bg-udhaar text-lg font-bold text-white disabled:opacity-40">Udhaar</button>
        </div>
        {entries.length > 0 && (
          <button onClick={reset} className="mt-3 min-h-14 w-full rounded-xl bg-red-600 text-lg font-bold text-white active:bg-red-700">
            Clear
          </button>
        )}
      </div>

      {editing && (
        <Sheet label={`Price for ${editing.name}`} onClose={() => setEditing(null)}>
          <h2 className="mb-1 text-lg font-semibold">{editing.name}</h2>
          <p className="mb-2 text-sm text-stone-600">Menu price {rupees(editing.price)}. Set the price to charge for each.</p>
          <input inputMode="numeric" value={editPrice} aria-label="Price each"
            onChange={(e) => setEditPrice(e.target.value.replace(/\D/g, ''))}
            className="mb-3 w-full rounded-xl border p-3 text-2xl" />
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => saveEditor(0)} className="min-h-12 rounded-xl border border-brand text-brand">Free</button>
            <button onClick={() => saveEditor(editing.price)} className="min-h-12 rounded-xl border">Reset</button>
            <button onClick={() => saveEditor()} className="min-h-12 rounded-xl bg-brand font-semibold text-white">Set</button>
          </div>
        </Sheet>
      )}

      {askUdhaar && (
        <Sheet label="Udhaar" onClose={() => setAskUdhaar(false)}>
          <h2 className="mb-1 text-lg font-semibold">Udhaar {rupees(total)}</h2>
          <p className="mb-2 text-sm text-stone-600">Who is taking this on credit?</p>
          <input list="udhaar-names" value={person} onChange={(e) => setPerson(e.target.value)}
            placeholder="Name" aria-label="Name" className="mb-3 w-full rounded-xl border p-3 text-lg" />
          <datalist id="udhaar-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
          <button disabled={!person.trim()} onClick={() => checkout('udhaar', canonicalName(person, names))}
            className="min-h-12 w-full rounded-xl bg-udhaar font-bold text-white disabled:opacity-40">Save udhaar</button>
        </Sheet>
      )}
    </div>
  )
}
