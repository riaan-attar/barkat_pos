const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

export const CartIcon = () => (
  <svg {...base}><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M3 4h2.5l2.2 11h10.6l2-8H6.4" /></svg>
)
export const ChartIcon = () => (
  <svg {...base}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
)
export const BookIcon = () => (
  <svg {...base}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" /><path d="M8 8h7M8 12h7" /></svg>
)
export const CupIcon = () => (
  <svg {...base}><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z" /><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3" /></svg>
)
export const ReceiptIcon = () => (
  <svg {...base}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path d="M9 8h6M9 12h6" /></svg>
)
export const TrashIcon = () => (
  <svg {...base} width={20} height={20}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
)
export const RestoreIcon = () => (
  <svg {...base} width={20} height={20}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>
)
