import { fetchSales, fetchUdhaar } from './stats'
import type { Item } from './types'

/** Quote a cell, and defuse spreadsheet formulas ("=...", "+...") typed into notes or names. */
function cell(v: unknown) {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(',')).join('\n')

function download(name: string, csv: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

/** Every bill line and every udhaar entry, including voided ones, as two CSV files. */
export async function exportEverything(items: Item[]) {
  const names = new Map(items.map((i) => [i.id, i.name]))
  const [sales, udhaar] = await Promise.all([fetchSales('1970-01-01T00:00:00Z', undefined, true), fetchUdhaar(true)])
  const stamp = new Date().toISOString().slice(0, 10)

  const lines: unknown[][] = [['date', 'time', 'bill_id', 'payment', 'person', 'note', 'item', 'qty', 'menu_price', 'charged_price', 'line_total', 'voided']]
  for (const s of [...sales].reverse()) {
    const d = new Date(s.created_at)
    for (const l of s.sale_items) {
      lines.push([d.toLocaleDateString('en-CA'), d.toLocaleTimeString('en-GB'), s.id, s.payment, s.person, s.note,
        names.get(l.item_id) ?? l.item_id, l.qty, l.list_price ?? l.unit_price, l.unit_price, l.qty * l.unit_price, s.voided_at ? 'yes' : ''])
    }
  }
  download(`barkat-bills-${stamp}.csv`, toCsv(lines))

  const ledger: unknown[][] = [['date', 'time', 'person', 'type', 'amount', 'method', 'note', 'voided']]
  for (const e of [...udhaar].reverse()) {
    const d = new Date(e.created_at)
    ledger.push([d.toLocaleDateString('en-CA'), d.toLocaleTimeString('en-GB'), e.person, e.kind, e.amount, e.method, e.note, e.voided_at ? 'yes' : ''])
  }
  setTimeout(() => download(`barkat-udhaar-${stamp}.csv`, toCsv(ledger)), 400)
}
