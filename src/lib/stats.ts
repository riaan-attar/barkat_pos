import { supabase } from './supabase'
import { todayStr } from './money'
import type { Item, Payment } from './types'

export interface SaleLineRec {
  item_id: number
  qty: number
  unit_price: number
  list_price: number | null
  batch_id: string | null
}
export interface SaleRec {
  id: string
  created_at: string
  payment: Payment
  total: number
  note: string | null
  person: string | null
  voided_at: string | null
  sale_items: SaleLineRec[]
}
export interface UdhaarRec {
  id: string
  person: string
  kind: 'credit_sale' | 'cash_lent' | 'repayment'
  amount: number
  method: 'cash' | 'online' | null
  sale_id: string | null
  note: string | null
  voided_at: string | null
  created_at: string
}

const SALE_SELECT =
  'id, created_at, payment, total, note, person, voided_at, sale_items(item_id, qty, unit_price, list_price, batch_id)'

/** Supabase returns at most 1000 rows per request, so page through. */
export async function fetchSales(from: string, to?: string, withVoided = false) {
  const all: SaleRec[] = []
  for (let page = 0; ; page++) {
    let q = supabase.from('sales').select(SALE_SELECT).gte('created_at', from)
      .order('created_at', { ascending: false }).range(page * 1000, page * 1000 + 999)
    if (to) q = q.lt('created_at', to)
    if (!withVoided) q = q.is('voided_at', null)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    all.push(...(data as unknown as SaleRec[]))
    if (data.length < 1000) return all
  }
}

export async function fetchUdhaar(withVoided = false) {
  const all: UdhaarRec[] = []
  for (let page = 0; ; page++) {
    let q = supabase.from('udhaar').select('*').order('created_at', { ascending: false }).range(page * 1000, page * 1000 + 999)
    if (!withVoided) q = q.is('voided_at', null)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    all.push(...(data as UdhaarRec[]))
    if (data.length < 1000) return all
  }
}

export const dayOf = (iso: string) => todayStr(new Date(iso))

/** Value given away on a bill: menu price minus what was charged. */
export const discountOf = (s: SaleRec) =>
  s.sale_items.reduce((a, l) => a + Math.max(0, (l.list_price ?? l.unit_price) - l.unit_price) * l.qty, 0)

export const signed = (e: UdhaarRec) => (e.kind === 'repayment' ? -e.amount : e.amount)

export interface Person {
  name: string
  balance: number
  entries: UdhaarRec[]
}

/** Group ledger by person, ignoring case and spacing differences. */
export function people(entries: UdhaarRec[]): Person[] {
  const map = new Map<string, Person>()
  for (const e of entries) {
    const key = e.person.trim().toLowerCase()
    const p = map.get(key) ?? { name: e.person.trim(), balance: 0, entries: [] }
    p.balance += signed(e)
    p.entries.push(e)
    map.set(key, p)
  }
  return [...map.values()].sort((a, b) => b.balance - a.balance)
}

/** Day helpers: days are local YYYY-MM-DD strings, which sort correctly as text. */
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number)
  return todayStr(new Date(y, m - 1, d + n))
}
export function daysBetween(from: string, to: string) {
  const t = (x: string) => new Date(x + 'T00:00:00').getTime()
  return Math.round((t(to) - t(from)) / 86_400_000) + 1
}
export const inRange = <T extends { created_at: string }>(list: T[], from: string, to: string) =>
  list.filter((x) => {
    const d = dayOf(x.created_at)
    return d >= from && d <= to
  })

export function summarize(s: SaleRec[], u: UdhaarRec[], items: Item[]) {
  const paid = s.filter((x) => x.payment !== 'udhaar')
  const sum = (list: SaleRec[], p: Payment) => list.filter((x) => x.payment === p).reduce((a, x) => a + x.total, 0)
  const cash = sum(s, 'cash')
  const online = sum(s, 'online')
  const repaid = u.filter((x) => x.kind === 'repayment').reduce((a, x) => a + x.amount, 0)
  const byId = new Map(items.map((i) => [i.id, i]))

  const counts = new Map<number, number>()
  let chaiCups = 0
  let blackTeaCups = 0
  const chaiContainers = new Set<string>()
  const hours = new Array(24).fill(0) as number[]
  for (const x of s) {
    hours[new Date(x.created_at).getHours()] += 1
    for (const l of x.sale_items) {
      counts.set(l.item_id, (counts.get(l.item_id) ?? 0) + l.qty)
      const it = byId.get(l.item_id)
      if (it?.batch_type === 'chai') {
        chaiCups += l.qty * it.cups
        if (l.batch_id) chaiContainers.add(l.batch_id)
      }
      if (it?.batch_type === 'black_tea') blackTeaCups += l.qty * it.cups
    }
  }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0]
  const peak = hours.indexOf(Math.max(...hours))

  return {
    bills: s.length,
    cash,
    online,
    moneyIn: cash + online + repaid,
    repaid,
    avgBill: paid.length ? Math.round((cash + online) / paid.length) : 0,
    creditGiven: sum(s, 'udhaar'),
    cashLent: u.filter((x) => x.kind === 'cash_lent').reduce((a, x) => a + x.amount, 0),
    discount: s.reduce((a, x) => a + discountOf(x), 0),
    chaiCups,
    blackTeaCups,
    containers: chaiContainers.size,
    bestSeller: best ? { name: byId.get(best[0])?.name ?? `#${best[0]}`, qty: best[1] } : null,
    peakHour: s.length ? peak : null,
  }
}

export const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`

/** Reuse the spelling of an existing person so "imran" and "Imran" never become two people. */
export function canonicalName(input: string, existing: string[]) {
  const name = input.trim().replace(/\s+/g, ' ')
  return existing.find((e) => e.toLowerCase() === name.toLowerCase()) ?? name
}
