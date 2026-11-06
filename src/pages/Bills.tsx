import { useState } from 'react'
import { useUI } from '../components/ui-context'
import { exportEverything } from '../lib/exportCsv'
import type { Item } from '../lib/types'
import History from './History'
import Today from './Today'

export default function Bills({ items }: { items: Item[] }) {
  const ui = useUI()
  const [view, setView] = useState<'day' | 'history'>('day')
  const [busy, setBusy] = useState(false)

  async function backup() {
    setBusy(true)
    try {
      await exportEverything(items)
      ui.toast('Backup downloaded (2 files)')
    } catch (e) {
      ui.toast((e as Error).message, 'error')
    }
    setBusy(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-2 gap-2 px-3 pt-3">
        {([['day', 'By day'], ['history', 'Last 30 days']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} aria-pressed={view === id}
            className={`min-h-11 rounded-lg text-sm ${view === id ? 'bg-brand font-semibold text-white' : 'border bg-white'}`}>{label}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === 'day' ? <Today items={items} /> : <History />}
        <div className="px-3 pb-4">
          <button disabled={busy} onClick={backup} className="min-h-12 w-full rounded-xl border border-brand font-semibold text-brand disabled:opacity-50">
            {busy ? 'Preparing…' : 'Download full backup (CSV)'}
          </button>
        </div>
      </div>
    </div>
  )
}
