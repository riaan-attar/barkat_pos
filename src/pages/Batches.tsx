import { useCallback, useEffect, useState } from 'react'
import { useUI } from '../components/ui-context'
import Skeleton from '../components/Skeleton'
import { supabase } from '../lib/supabase'
import { dayRange, todayStr } from '../lib/money'
import type { Batch, Item } from '../lib/types'

interface Props {
  items: Item[]
  openBatches: Batch[]
  refresh: () => Promise<void>
}

const LABEL = { chai: 'Chai', black_tea: 'Black Tea' } as const
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function Batches({ items, openBatches, refresh }: Props) {
  const ui = useUI()
  const [shown, setShown] = useState<Batch[] | null>(null)
  const [sold, setSold] = useState<Record<string, number>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { start } = dayRange(todayStr())
    const { data, error } = await supabase.from('batches').select('*').gte('started_at', start).order('started_at')
    if (error) return setErr(error.message)
    setErr('')
    // Include a container still open from before today.
    const all = new Map<string, Batch>()
    for (const b of [...openBatches, ...((data ?? []) as Batch[])]) all.set(b.id, b)
    const list = [...all.values()].sort((a, b) => a.started_at.localeCompare(b.started_at))
    setShown(list)
    if (!list.length) return setSold({})

    // Voided bills do not count toward a container.
    const lines = await supabase
      .from('sale_items')
      .select('batch_id, item_id, qty, sales!inner(voided_at)')
      .is('sales.voided_at', null)
      .in('batch_id', list.map((b) => b.id))
    const cupsPer = new Map(items.map((i) => [i.id, i.cups]))
    const out: Record<string, number> = {}
    for (const r of (lines.data ?? []) as { batch_id: string; item_id: number; qty: number }[]) out[r.batch_id] = (out[r.batch_id] ?? 0) + r.qty * (cupsPer.get(r.item_id) ?? 1)
    setSold(out)
  }, [openBatches, items])

  useEffect(() => {
    // Fetch on mount and when inputs change.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  async function next(type: 'chai' | 'black_tea') {
    const current = openBatches.filter((b) => b.type === type)
    if (current.length) {
      const ok = await ui.confirm({ title: `${LABEL[type]} container finished?`, message: 'This closes the current container and starts the next one.', confirmLabel: 'Yes, next' })
      if (!ok) return
    }
    setBusy(true)
    setErr('')
    if (current.length) {
      const { error } = await supabase
        .from('batches')
        .update({ closed_at: new Date().toISOString() })
        .in('id', current.map((b) => b.id))
      if (error) {
        setBusy(false)
        return setErr(error.message)
      }
    }
    const { error } = await supabase.from('batches').insert({ type })
    if (error) setErr(error.message)
    else ui.toast(`New ${LABEL[type]} container started`)
    await refresh()
    setBusy(false)
  }

  if (!shown) return <div className="p-3">{err ? <p className="text-red-700">{err}</p> : <Skeleton rows={2} className="h-48" />}</div>

  return (
    <div className="h-full space-y-4 overflow-y-auto p-3">
      {err && <p className="text-sm text-red-700" role="alert">{err}</p>}
      {(['chai', 'black_tea'] as const).map((type) => {
        const mine = shown.filter((b) => b.type === type)
        const current = mine.find((b) => !b.closed_at)
        const earlier = mine.filter((b) => b.closed_at).reverse()
        return (
          <section key={type} className="rounded-2xl border bg-white p-3">
            <h2 className="mb-2 text-lg font-semibold">{LABEL[type]}</h2>
            {current ? (
              <div className="mb-3 rounded-xl bg-amber-50 p-3 text-center">
                <div className="text-sm text-stone-600">Current container · since {time(current.started_at)}</div>
                <div className="text-5xl font-bold text-brand-dark">{sold[current.id] ?? 0}</div>
                <div className="text-sm text-stone-600">cups sold</div>
              </div>
            ) : (
              <p className="mb-3 text-sm text-stone-600">No container running.</p>
            )}
            <button disabled={busy} onClick={() => next(type)}
              className="w-full rounded-xl bg-brand py-4 text-lg font-bold text-white disabled:opacity-50">
              {current ? 'Container finished, next' : 'Start first container'}
            </button>
            {earlier.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-xs uppercase tracking-wide text-stone-600">Earlier today</div>
                {earlier.map((b) => (
                  <div key={b.id} className="flex justify-between border-t py-1 text-sm">
                    <span>{time(b.started_at)} – {time(b.closed_at!)}</span>
                    <span className="font-semibold">{sold[b.id] ?? 0} cups</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
