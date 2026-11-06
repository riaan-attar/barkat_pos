export const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`

/** Local-day [start, end) as ISO strings for a YYYY-MM-DD string. */
export function dayRange(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  const start = new Date(y, m - 1, d)
  const end = new Date(y, m - 1, d + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function todayStr(date = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}
