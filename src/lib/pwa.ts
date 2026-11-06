import { registerSW } from 'virtual:pwa-register'

type Listener = (needsRefresh: boolean) => void
let listener: Listener | null = null
let needs = false

// Prompt mode: a new version is downloaded in the background but only applied when the user taps Reload,
// so the screen never refreshes in the middle of a sale.
const update = registerSW({
  onNeedRefresh() {
    needs = true
    listener?.(true)
  },
})

export const applyUpdate = () => update(true)
export function onUpdateAvailable(fn: Listener) {
  listener = fn
  if (needs) fn(true)
  return () => {
    listener = null
  }
}
