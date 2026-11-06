export default function Skeleton({ rows = 3, className = 'h-16' }: { rows?: number; className?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={`animate-pulse rounded-2xl bg-stone-200 ${className}`} />
      ))}
    </div>
  )
}
