import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setErr(/invalid login/i.test(error.message) ? 'Wrong email or password.' : error.message)
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="mx-auto flex h-full max-w-sm flex-col justify-center gap-3 p-6">
      <h1 className="text-3xl font-bold text-brand-dark">Barkat Chai</h1>
      <p className="-mt-2 text-sm text-stone-600">Sign in to open the till.</p>
      <label className="text-sm font-semibold" htmlFor="email">Email</label>
      <input id="email" className="rounded-xl border bg-white p-3" type="email" autoComplete="username" inputMode="email"
        value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label className="text-sm font-semibold" htmlFor="password">Password</label>
      <input id="password" className="rounded-xl border bg-white p-3" type="password" autoComplete="current-password"
        value={password} onChange={(e) => setPassword(e.target.value)} required />
      {err && <p className="text-sm text-red-700" role="alert">{err}</p>}
      <button disabled={busy} className="min-h-12 rounded-xl bg-brand font-semibold text-white disabled:opacity-50">
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
