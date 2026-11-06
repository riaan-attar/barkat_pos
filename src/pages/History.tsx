import { useEffect, useState } from 'react'
import { rupees, todayStr } from '../lib/money'
import Skeleton from '../components/Skeleton'
import { fetchSales } from '../lib/stats'

interface Row { day: string; cash: number; online: number; udhaar: number; bills: number }

export default function History() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    const from = new Date()
    from.setDate(from.getDate() - 29)
    from.setHours(0, 0, 0, 0)
    fetchSales(from.toISOString())
      .then((data) => {
        const map = new Map<string, Row>()
        for (const s of data) {
          const day = todayStr(new Date(s.created_at))
          const r = map.get(day) ?? { day, cash: 0, online: 0, udhaar: 0, bills: 0 }
          r[s.payment] += s.total
          r.bills += 1
          map.set(day, r)
        }
        setRows([...map.values()].sort((a, b) => b.day.localeCompare(a.day)))
      })
      .catch((e: Error) => setErr(e.message))
  }, [])

  function exportCsv() {
    if (!rows) return
    const csv = [
      'date,bills,cash,online,udhaar,total_cash_online',
      ...(rows ?? []).map((r) => `${r.day},${r.bills},${r.cash},${r.online},${r.udhaar},${r.cash + r.online}`),
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'barkat-sales.csv'
    a.click()
  }

  return (
    <div className="space-y-3 p-3">
      {err && <p className="text-sm text-red-700">{err}</p>}
      <button onClick={exportCsv} className="min-h-12 w-full rounded-xl border border-brand font-semibold text-brand">Export daily totals (CSV)</button>
      {!rows && !err && <Skeleton rows={4} className="h-20" />}
      {rows?.map((r) => (
        <div key={r.day} className="rounded-xl border bg-white p-3">
          <div className="flex justify-between">
            <span className="font-semibold">{new Date(r.day + 'T00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <span className="text-lg font-bold">{rupees(r.cash + r.online)}</span>
          </div>
          <div className="text-xs text-stone-600">
            {r.bills} bills · Cash {rupees(r.cash)} · Online {rupees(r.online)}
            {r.udhaar > 0 && ` · Udhaar ${rupees(r.udhaar)}`}
          </div>
        </div>
      ))}
      {rows && !rows.length && <p className="text-center text-stone-600">No sales in the last 30 days</p>}
    </div>
  )
}
