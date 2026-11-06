import { Component, type ReactNode } from 'react'

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error('App crashed', error)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="text-sm text-stone-600">Your saved sales are safe. Reload to continue.</p>
        <button onClick={() => location.reload()} className="min-h-12 rounded-xl bg-brand px-6 font-semibold text-white">Reload</button>
      </div>
    )
  }
}
