export type BatchType = 'chai' | 'black_tea' | 'none'
export type Payment = 'cash' | 'online' | 'udhaar'

export interface Item {
  id: number
  name: string
  price: number
  batch_type: BatchType
  cups: number
  sort: number
}

export interface Batch {
  id: string
  type: 'chai' | 'black_tea'
  started_at: string
  qty_cups: number | null
  closed_at: string | null
  wasted_cups: number
}

export interface SaleLine {
  item_id: number
  qty: number
  unit_price: number
  list_price: number
  batch_id: string | null
}

export interface PendingSale {
  id: string
  created_at: string
  payment: Payment
  total: number
  note?: string
  person?: string
  lines: SaleLine[]
}

export interface FailedSale {
  sale: PendingSale
  error: string
}
