import { useCallback, useEffect, useState } from 'react'
import Sheet from '../components/Sheet'
import { useUI } from '../components/ui-context'
import Skeleton from '../components/Skeleton'
import { TrashIcon } from '../components/icons'
import { rupees } from '../lib/money'
import { canonicalName, fetchUdhaar, people, type Person, type UdhaarRec } from '../lib/stats'
import { supabase } from '../lib/supabase'
import { uuid } from '../lib/uuid'

type Mode = null | { kind: 'cash_lent' | 'repayment'; person?: string }
const KIND = { credit_sale: 'Took items', cash_lent: 'Cash lent', repayment: 'Paid back' } as const

export default function Udhaar() {
  const ui = useUI()
  const [entries, setEntries] = useState<UdhaarRec[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'cash' | 'online'>('cash')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      setEntries(await fetchUdhaar())
      setErr('')
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [])

  useEffect(() => {
    // Fetch on mount and when inputs change.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  const list = people(entries ?? [])
  const outstanding = list.reduce((a, p) => a + Math.max(0, p.balance), 0)

  function start(kind: 'cash_lent' | 'repayment', person?: string) {
    setMode({ kind, person })
    setName(person ?? '')
    setAmount('')
    setNote('')
    setMethod('cash')
  }

  async function save() {
    if (!mode) return
    const amt = parseInt(amount)
    if (!name.trim() || !amt || amt <= 0) return
    const { error } = await supabase.from('udhaar').insert({
      id: uuid(),
      person: canonicalName(name, list.map((p) => p.name)),
      kind: mode.kind,
      amount: amt,
      method: mode.kind === 'repayment' ? method : 'cash',
      note: note.trim() || null,
    })
    if (error) return ui.toast(error.message, 'error')
    setMode(null)
    ui.toast(mode.kind === 'repayment' ? 'Payment recorded' : 'Loan recorded')
    void load()
  }

  async function remove(e: UdhaarRec) {
    if (e.kind === 'credit_sale') return ui.toast('This came from a bill. Void the bill in the Bills tab.', 'error')
    const ok = await ui.confirm({ title: 'Remove this entry?', message: `${KIND[e.kind]} ${rupees(e.amount)} for ${e.person}`, confirmLabel: 'Remove', danger: true })
    if (!ok) return
    // Soft delete: the row stays in the database for the record.
    const { error } = await supabase.from('udhaar').update({ voided_at: new Date().toISOString() }).eq('id', e.id)
    if (error) return ui.toast(error.message, 'error')
    void load()
  }

  const selected: Person | undefined = list.find((p) => p.name.toLowerCase() === open?.toLowerCase())

  return (
    <div className="h-full space-y-3 overflow-y-auto p-3">
      {err && <p className="text-sm text-red-700" role="alert">{err}</p>}
      {!entries && !err && <Skeleton rows={3} />}
      <div className="rounded-2xl bg-udhaar p-4 text-white">
        <div className="text-sm opacity-80">Total owed to you</div>
        <div className="text-4xl font-bold">{rupees(outstanding)}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => start('cash_lent')} className="rounded-xl border border-udhaar py-3 font-semibold text-udhaar">Lent cash</button>
        <button onClick={() => start('repayment')} className="rounded-xl bg-udhaar py-3 font-semibold text-white">Got payment</button>
      </div>

      {selected ? (
        <section className="rounded-2xl border bg-white p-3">
          <button onClick={() => setOpen(null)} className="mb-1 text-sm text-udhaar">← All people</button>
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">{selected.name}</h2>
            <span className="text-2xl font-bold">{rupees(selected.balance)}</span>
          </div>
          <button onClick={() => start('repayment', selected.name)} className="my-2 w-full rounded-lg bg-udhaar py-2 text-white">Got payment</button>
          {selected.entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between border-t py-2">
              <div>
                <div className="text-sm font-semibold">{KIND[e.kind]}{e.kind === 'repayment' && e.method ? ` (${e.method})` : ''}</div>
                <div className="text-xs text-stone-600">{new Date(e.created_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{e.note ? ` · ${e.note}` : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={e.kind === 'repayment' ? 'font-semibold text-green-700' : 'font-semibold'}>
                  {e.kind === 'repayment' ? '−' : '+'}{rupees(e.amount)}
                </span>
                <button onClick={() => remove(e)} className="flex h-11 w-11 items-center justify-center text-red-700" aria-label="Remove entry"><TrashIcon /></button>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="rounded-2xl border bg-white px-3">
          {list.map((p) => (
            <button key={p.name} onClick={() => setOpen(p.name)} className="flex w-full items-center justify-between border-t py-3 first:border-0">
              <span className="font-semibold">{p.name}</span>
              <span className={p.balance > 0 ? 'text-lg font-bold text-udhaar' : 'text-stone-600'}>{rupees(p.balance)}</span>
            </button>
          ))}
          {entries && !list.length && <p className="py-4 text-center text-sm text-stone-600">No udhaar yet</p>}
        </section>
      )}

      {mode && (
        <Sheet label={mode.kind === 'cash_lent' ? 'Lent cash' : 'Got payment'} onClose={() => setMode(null)}>
          <h2 className="mb-2 text-lg font-semibold">{mode.kind === 'cash_lent' ? 'Lent cash' : 'Got payment'}</h2>
          <input list="people" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name"
            disabled={Boolean(mode.person)} className="mb-2 w-full rounded-xl border p-3" />
          <datalist id="people">{list.map((p) => <option key={p.name} value={p.name} />)}</datalist>
          <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            placeholder="Amount" aria-label="Amount" className="mb-2 w-full rounded-xl border p-3 text-2xl" />
          {mode.kind === 'repayment' && (
            <div className="mb-2 grid grid-cols-2 gap-2">
              {(['cash', 'online'] as const).map((m) => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`rounded-xl border py-2 ${method === m ? 'border-udhaar bg-purple-100 font-semibold' : ''}`}>{m === 'cash' ? 'Cash' : 'Online'}</button>
              ))}
            </div>
          )}
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="mb-3 w-full rounded-xl border p-3" />
          <button onClick={save} className="w-full rounded-xl bg-udhaar py-3 font-bold text-white">Save</button>
        </Sheet>
      )}
    </div>
  )
}
