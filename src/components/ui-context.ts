import { createContext, useContext } from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}
export interface ToastItem {
  id: number
  text: string
  kind: 'info' | 'error'
}
export interface UI {
  toast: (text: string, kind?: 'info' | 'error') => void
  confirm: (o: ConfirmOptions) => Promise<boolean>
}

export const Ctx = createContext<UI | null>(null)
export const useUI = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('useUI outside FeedbackProvider')
  return v
}
