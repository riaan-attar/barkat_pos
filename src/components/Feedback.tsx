import { useCallback, useEffect, useRef, useState } from 'react'
import { Ctx, type ConfirmOptions, type ToastItem } from './ui-context'
import Sheet from './Sheet'

/** Replaces alert()/confirm(): in-app toasts and confirmation sheets. */
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [ask, setAsk] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const nextId = useRef(0)

  const toast = useCallback((text: string, kind: 'info' | 'error' = 'info') => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setAsk({ ...o, resolve })), [])

  const answer = (v: boolean) => {
    ask?.resolve(v)
    setAsk(null)
  }

  // A dialog dismissed by Escape or backdrop counts as "no".
  useEffect(() => () => ask?.resolve(false), [ask])

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-12 z-40 mx-auto flex max-w-md flex-col gap-2 px-3" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm text-white shadow-lg ${t.kind === 'error' ? 'bg-red-700' : 'bg-stone-800'}`}>
            {t.text}
          </div>
        ))}
      </div>
      {ask && (
        <Sheet label={ask.title} onClose={() => answer(false)}>
          <h2 className="text-lg font-semibold">{ask.title}</h2>
          {ask.message && <p className="mt-1 text-sm text-stone-600">{ask.message}</p>}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button onClick={() => answer(false)} className="min-h-12 rounded-xl border font-semibold">Cancel</button>
            <button onClick={() => answer(true)}
              className={`min-h-12 rounded-xl font-semibold text-white ${ask.danger ? 'bg-red-700' : 'bg-brand'}`}>
              {ask.confirmLabel ?? 'OK'}
            </button>
          </div>
        </Sheet>
      )}
    </Ctx.Provider>
  )
}
