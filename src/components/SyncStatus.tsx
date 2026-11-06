import { useState, useSyncExternalStore } from 'react'
import { discardFailed, flush, getQueueState, retryFailed, subscribeQueue } from '../lib/offlineQueue'
import { rupees } from '../lib/money'
import Sheet from './Sheet'

/** Header indicator: green = everything is on the server, orange = waiting, red = needs attention. */
export default function SyncStatus() {
  const q = useSyncExternalStore(subscribeQueue, getQueueState)
  const [open, setOpen] = useState(false)

  const tone = q.failed.length ? 'bg-red-600' : q.pending ? 'bg-orange-500' : 'bg-green-500'
  const text = q.failed.length ? `${q.failed.length} failed` : q.pending ? `${q.pending} waiting` : 'Synced'

  return (
    <>
      <button onClick={() => (q.failed.length || q.pending ? setOpen(true) : void flush())}
        className="flex min-h-11 items-center gap-2 px-2 text-xs" aria-label={`Sync status: ${text}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${tone} ${q.syncing ? 'animate-pulse' : ''}`} />
        {text}
      </button>
      {open && (
        <Sheet label="Sync status" onClose={() => setOpen(false)}>
          <h2 className="mb-2 text-lg font-semibold">Sales not yet saved</h2>
          {q.pending > 0 && (
            <p className="mb-3 text-sm text-stone-600">
              {q.pending} sale{q.pending > 1 ? 's are' : ' is'} stored on this phone and will upload automatically when the
              internet is back.{q.lastError ? ` (${q.lastError})` : ''}
            </p>
          )}
          {q.failed.map((f) => (
            <div key={f.sale.id} className="mb-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="font-semibold">{rupees(f.sale.total)} · {f.sale.payment}</div>
              <div className="text-xs text-stone-600">{new Date(f.sale.created_at).toLocaleString()}</div>
              <div className="my-1 text-xs text-red-700">{f.error}</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => retryFailed(f.sale.id)} className="min-h-11 rounded-lg bg-brand text-white">Retry</button>
                <button onClick={() => discardFailed(f.sale.id)} className="min-h-11 rounded-lg border">Discard</button>
              </div>
            </div>
          ))}
          <button onClick={() => { void flush(); setOpen(false) }} className="mt-2 min-h-12 w-full rounded-xl border font-semibold">Try now</button>
        </Sheet>
      )}
    </>
  )
}
