import { useCallback, useEffect, useState } from 'react'
import { useUI } from '../components/ui-context'
import { RestoreIcon, TrashIcon } from '../components/icons'
import Skeleton from '../components/Skeleton'
import { setVoided } from '../lib/offlineQueue'
import { dayRange, rupees, todayStr } from '../lib/money'
import { discountOf, fetchSales, type SaleRec } from '../lib/stats'
import type { Item, Payment } from '../lib/types'

const BADGE: Record<Payment, string> = {
  cash: 'bg-green-100 text-green-900',
  online: 'bg-blue-100 text-blue-900',
  udhaar: 'bg-purple-100 text-purple-900',
}

export default function Today({ items }: { items: Item[] }) {
  const ui = useUI()
  const [day, setDay] = useState(todayStr())
  const [data, setData] = useState<{ day: string; sales: SaleRec[] } | null>(null)
  const all = data?.day === day ? data.sales : null
  const [showVoided, setShowVoided] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { start, end } = dayRange(day)
    try {
      setData({ day, sales: await fetchSales(start, end, true) })
      setErr('')
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [day])

  useEffect(() => {
    // Fetching on mount/day change is the external sync this effect exists for.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  const sales = (all ?? []).filter((s) => !s.voided_at)
  const voided = (all ?? []).filter((s) => s.voided_at)
  const shown = showVoided ? all ?? [] : sales
  const sum = (p: Payment) => sales.filter((s) => s.payment === p).reduce((a, s) => a + s.total, 0)
  const names = new Map(items.map((i) => [i.id, i.name]))
  const counts = new Map<number, number>()
  sales.forEach((s) => s.sale_items.forEach((l) => counts.set(l.item_id, (counts.get(l.item_id) ?? 0) + l.qty)))

  async function toggleVoid(s: SaleRec) {
    if (!s.voided_at) {
      const ok = await ui.confirm({
        title: 'Void this bill?',
        message: `${rupees(s.total)} will be removed from the totals. You can restore it later.`,
        confirmLabel: 'Void bill',
        danger: true,
      })
      if (!ok) return
    }
    try {
      await setVoided(s.id, !s.voided_at)
      ui.toast(s.voided_at ? 'Bill restored' : 'Bill voided')
      void load()
    } catch (e) {
      ui.toast((e as Error).message, 'error')
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex gap-2">
        <input type="date" value={day} max={todayStr()} aria-label="Day" onChange={(e) => e.target.value && setDay(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border bg-white p-3" />
        <button onClick={() => void load()} className="min-h-12 rounded-xl border bg-white px-4 font-semibold">Refresh</button>
      </div>
      {err && <p className="text-sm text-red-700" role="alert">{err}</p>}
      {!all && !err && <Skeleton rows={3} />}

      {all && (
        <>
          <div className="rounded-2xl bg-brand p-4 text-white">
            <div className="text-sm opacity-90">Sales · {sales.length} bills</div>
            <div className="text-4xl font-bold">{rupees(sum('cash') + sum('online'))}</div>
            <div className="mt-2 flex flex-wrap gap-x-6 text-sm">
              <span>Cash {rupees(sum('cash'))}</span>
              <span>Online {rupees(sum('online'))}</span>
              {sum('udhaar') > 0 && <span>Udhaar {rupees(sum('udhaar'))}</span>}
            </div>
          </div>

          <section className="rounded-2xl border bg-white p-3">
            <h2 className="mb-1 font-semibold">Items sold</h2>
            {[...counts].sort((a, b) => b[1] - a[1]).map(([id, q]) => (
              <div key={id} className="flex justify-between border-t py-1 first:border-0">
                <span>{names.get(id) ?? `#${id}`}</span><span className="font-semibold">{q}</span>
              </div>
            ))}
            {!counts.size && <p className="text-sm text-stone-600">No sales yet</p>}
          </section>

          <section className="rounded-2xl border bg-white p-3">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-semibold">Bills</h2>
              {voided.length > 0 && (
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
                  Show voided ({voided.length})
                </label>
              )}
            </div>
            {shown.map((s) => {
              const disc = discountOf(s)
              return (
                <div key={s.id} className={`flex items-center justify-between border-t py-2 first:border-0 ${s.voided_at ? 'opacity-60' : ''}`}>
                  <div className="min-w-0">
                    <div className={`font-semibold ${s.voided_at ? 'line-through' : ''}`}>{rupees(s.total)}
                      <span className={`ml-2 rounded px-1.5 text-xs no-underline ${BADGE[s.payment]}`}>
                        {s.payment === 'udhaar' ? `udhaar · ${s.person}` : s.payment}
                      </span>
                      {disc > 0 && <span className="ml-1 rounded bg-orange-100 px-1.5 text-xs text-discount">−{rupees(disc)}</span>}
                      {s.voided_at && <span className="ml-1 rounded bg-stone-200 px-1.5 text-xs">voided</span>}
                    </div>
                    <div className="truncate text-xs text-stone-600">
                      {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                      {s.sale_items.map((l) => `${l.qty}× ${names.get(l.item_id) ?? l.item_id}`).join(', ')}
                      {s.note ? ` · ${s.note}` : ''}
                    </div>
                  </div>
                  <button onClick={() => toggleVoid(s)} className={`flex h-11 w-11 shrink-0 items-center justify-center ${s.voided_at ? 'text-cash' : 'text-red-700'}`}
                    aria-label={s.voided_at ? 'Restore bill' : 'Void bill'}>
                    {s.voided_at ? <RestoreIcon /> : <TrashIcon />}
                  </button>
                </div>
              )
            })}
            {!shown.length && <p className="text-sm text-stone-600">No bills</p>}
          </section>
        </>
      )}
    </div>
  )
}
