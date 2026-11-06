import { useEffect, useState } from 'react'
import Skeleton from '../components/Skeleton'
import { rupees, todayStr } from '../lib/money'
import {
  addDays, daysBetween, fetchSales, fetchUdhaar, hourLabel, inRange, signed, summarize,
  type SaleRec, type UdhaarRec,
} from '../lib/stats'
import type { Item } from '../lib/types'

type Preset = 'today' | 'yesterday' | '7d' | '30d' | 'custom'
const PRESETS: [Preset, string][] = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', '7 days'], ['30d', '30 days'], ['custom', 'Custom'],
]

export default function Dashboard({ items }: { items: Item[] }) {
  const today = todayStr()
  const [preset, setPreset] = useState<Preset>('today')
  const [cFrom, setCFrom] = useState(addDays(today, -6))
  const [cTo, setCTo] = useState(today)
  const [sales, setSales] = useState<SaleRec[] | null>(null)
  const [udhaar, setUdhaar] = useState<UdhaarRec[]>([])
  const [err, setErr] = useState('')
  const [reload, setReload] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  let from = today
  let to = today
  if (preset === 'yesterday') from = to = addDays(today, -1)
  if (preset === '7d') from = addDays(today, -6)
  if (preset === '30d') from = addDays(today, -29)
  if (preset === 'custom') {
    from = cFrom <= cTo ? cFrom : cTo
    to = cFrom <= cTo ? cTo : cFrom
  }
  const n = daysBetween(from, to)
  const prevFrom = addDays(from, -n)
  const prevTo = addDays(from, -1)

  useEffect(() => {
    let live = true
    Promise.all([fetchSales(new Date(prevFrom + 'T00:00:00').toISOString()), fetchUdhaar()])
      .then(([s, u]) => {
        if (!live) return
        setSales(s)
        setUdhaar(u)
        setUpdatedAt(new Date())
        setErr('')
      })
      .catch((e: Error) => live && setErr(e.message))
    return () => {
      live = false
    }
  }, [prevFrom, reload])

  const filters = (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PRESETS.map(([id, label]) => (
          <button key={id} onClick={() => setPreset(id)}
            aria-pressed={preset === id}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm ${preset === id ? 'bg-brand font-semibold text-white' : 'border bg-white'}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-stone-600">
        <span>{updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
        <button onClick={() => { setSales(null); setReload((n) => n + 1) }} className="min-h-11 px-3 font-semibold text-brand">Refresh</button>
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={cFrom} max={today} onChange={(e) => e.target.value && setCFrom(e.target.value)} className="rounded-xl border bg-white p-2" />
          <input type="date" value={cTo} max={today} onChange={(e) => e.target.value && setCTo(e.target.value)} className="rounded-xl border bg-white p-2" />
        </div>
      )}
    </div>
  )

  if (err && !sales)
    return (
      <div className="space-y-3 p-3">
        {filters}
        <p className="text-red-700" role="alert">{err}</p>
      </div>
    )
  if (!sales)
    return (
      <div className="space-y-3 p-3">
        {filters}
        <Skeleton rows={4} className="h-24" />
      </div>
    )

  const cur = summarize(inRange(sales, from, to), inRange(udhaar, from, to), items)
  const prev = summarize(inRange(sales, prevFrom, prevTo), inRange(udhaar, prevFrom, prevTo), items)
  const diff = prev.moneyIn ? Math.round(((cur.moneyIn - prev.moneyIn) / prev.moneyIn) * 100) : null
  const outstanding = udhaar.reduce((a, e) => a + signed(e), 0)
  const label = preset === 'custom' ? `${from} to ${to}` : PRESETS.find(([id]) => id === preset)![1].toLowerCase()
  const vs = n === 1 ? 'the day before' : `previous ${n} days`

  const bars = Array.from({ length: n }, (_, i) => {
    const day = addDays(from, i)
    return { day, moneyIn: summarize(inRange(sales, day, day), inRange(udhaar, day, day), items).moneyIn }
  })
  const max = Math.max(1, ...bars.map((b) => b.moneyIn))
  const slot = 280 / bars.length
  const bw = Math.max(2, slot - (bars.length > 14 ? 1 : 12))

  return (
    <div className="h-full space-y-3 overflow-y-auto p-3">
      {filters}
      <div className="rounded-2xl bg-brand p-4 text-white">
        <div className="text-sm opacity-90">Money in · {label}</div>
        <div className="text-5xl font-bold">{rupees(cur.moneyIn)}</div>
        <div className="mt-1 text-sm opacity-90">
          {diff === null ? `Nothing in ${vs}` : `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)}% vs ${vs} (${rupees(prev.moneyIn)})`}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="Cash" value={rupees(cur.cash)} />
        <Tile label="Online" value={rupees(cur.online)} />
        <Tile label="Bills" value={String(cur.bills)} sub={cur.avgBill ? `avg ${rupees(cur.avgBill)}` : undefined} />
        <Tile label="Busiest hour" value={cur.peakHour === null ? '–' : hourLabel(cur.peakHour)} />
        <Tile label="Chai cups" value={String(cur.chaiCups)} sub={`${cur.containers} container${cur.containers === 1 ? '' : 's'}`} />
        <Tile label="Black tea cups" value={String(cur.blackTeaCups)} />
        <Tile label="Best seller" value={cur.bestSeller?.name ?? '–'} sub={cur.bestSeller ? `${cur.bestSeller.qty} sold` : undefined} small />
        <Tile label="Free / discount" value={rupees(cur.discount)} />
        <Tile label="Udhaar given" value={rupees(cur.creditGiven)} tone="purple" />
        <Tile label="Cash lent" value={rupees(cur.cashLent)} tone="purple" />
        <Tile label="Paid back" value={rupees(cur.repaid)} tone="purple" />
        <Tile label="Total owed (all time)" value={rupees(outstanding)} tone="purple" />
      </div>

      {n > 1 && (
        <section className="rounded-2xl border bg-white p-3">
          <h2 className="mb-2 text-sm text-stone-600">Money in per day</h2>
          <svg viewBox="0 0 280 120" className="w-full" role="img" aria-label="Money in per day">
            {bars.map((b, i) => {
              const h = (b.moneyIn / max) * 78
              const x = i * slot + (slot - bw) / 2
              const cx = x + bw / 2
              const showAll = bars.length <= 8
              return (
                <g key={b.day}>
                  <rect x={x} y={92 - h} width={bw} height={h} rx={bw > 6 ? 4 : 1} fill={b.day === today ? '#92400e' : '#fcd34d'} />
                  {showAll && <text x={cx} y={86 - h} textAnchor="middle" fontSize="9" fill="#44403c">{b.moneyIn || ''}</text>}
                  {(showAll || i % 5 === 0) && (
                    <text x={cx} y={108} textAnchor="middle" fontSize="10" fill="#57534e">
                      {showAll ? new Date(b.day + 'T00:00').toLocaleDateString([], { weekday: 'short' }).slice(0, 2) : b.day.slice(8)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </section>
      )}
    </div>
  )
}

function Tile({ label, value, sub, tone, small }: { label: string; value: string; sub?: string; tone?: 'purple'; small?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${tone === 'purple' ? 'border-purple-200 bg-purple-50' : 'border-amber-200 bg-white'}`}>
      <div className="text-xs text-stone-600">{label}</div>
      <div className={`font-bold ${small ? 'text-xl' : 'text-3xl'}`}>{value}</div>
      {sub && <div className="text-xs text-stone-600">{sub}</div>}
    </div>
  )
}
