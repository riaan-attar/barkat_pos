import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { FeedbackProvider } from './components/Feedback'
import { useUI } from './components/ui-context'
import SyncStatus from './components/SyncStatus'
import { BookIcon, CartIcon, ChartIcon, CupIcon, ReceiptIcon } from './components/icons'
import { configured, supabase } from './lib/supabase'
import { flush, getQueueState } from './lib/offlineQueue'
import { applyUpdate, onUpdateAvailable } from './lib/pwa'
import { useShop } from './lib/useShop'
import Login from './pages/Login'
import Sell from './pages/Sell'
import Batches from './pages/Batches'
import Dashboard from './pages/Dashboard'
import Udhaar from './pages/Udhaar'
import Bills from './pages/Bills'

const TABS = [
  { id: 'sell', label: 'Sell', Icon: CartIcon },
  { id: 'dashboard', label: 'Stats', Icon: ChartIcon },
  { id: 'udhaar', label: 'Udhaar', Icon: BookIcon },
  { id: 'batches', label: 'Batches', Icon: CupIcon },
  { id: 'bills', label: 'Bills', Icon: ReceiptIcon },
] as const
type Tab = (typeof TABS)[number]['id']

export default function App() {
  return (
    <FeedbackProvider>
      <Shell />
    </FeedbackProvider>
  )
}

function Shell() {
  const ui = useUI()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<Tab>('sell')
  const [update, setUpdate] = useState(false)
  const shop = useShop()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) void flush()
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => onUpdateAvailable(setUpdate), [])

  async function signOut() {
    const { pending, failed } = getQueueState()
    if (pending + failed.length > 0) {
      const ok = await ui.confirm({
        title: 'Sign out with unsaved sales?',
        message: `${pending + failed.length} sale(s) have not reached the server yet. They stay on this phone and upload after you sign in again.`,
        confirmLabel: 'Sign out',
        danger: true,
      })
      if (!ok) return
    }
    await supabase.auth.signOut()
  }

  if (!configured)
    return (
      <div className="mx-auto max-w-sm p-6">
        <h1 className="mb-2 text-xl font-bold">Not configured</h1>
        <p className="text-sm text-stone-600">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README) and rebuild.</p>
      </div>
    )
  if (!ready) return null
  if (!session) return <Login />

  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-amber-50">
      <header className="flex items-center justify-between bg-brand pl-4 pr-1 text-white">
        <span className="font-bold">Barkat Chai</span>
        <div className="flex items-center">
          <SyncStatus />
          <button onClick={signOut} className="min-h-11 px-3 text-xs underline">Sign out</button>
        </div>
      </header>
      {update && (
        <div className="flex items-center justify-between bg-stone-800 px-4 py-2 text-sm text-white" role="status">
          <span>New version available</span>
          <button onClick={() => applyUpdate()} className="min-h-11 px-3 font-semibold underline">Reload</button>
        </div>
      )}
      <main className="min-h-0 flex-1">
        {tab === 'sell' && <Sell items={shop.items} openBatches={shop.openBatches} />}
        {tab === 'dashboard' && <Dashboard items={shop.items} />}
        {tab === 'udhaar' && <Udhaar />}
        {tab === 'batches' && <Batches items={shop.items} openBatches={shop.openBatches} refresh={shop.refresh} />}
        {tab === 'bills' && <Bills items={shop.items} />}
      </main>
      <nav className="grid grid-cols-5 border-t bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => { setTab(id); if (id === 'sell' || id === 'batches') void shop.refresh() }}
            aria-current={tab === id ? 'page' : undefined}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${tab === id ? 'font-bold text-brand' : 'text-stone-600'}`}>
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
