/**
 * 契約者ポータルで使う状態表示。色だけに頼らず、必ずアイコン＋文字で示す
 * （docs/design/07-screens.md §7.1、docs/design/09-ux-improvements.md §9.4.8）。
 */
export type PortalStatusKind = 'paid' | 'pending' | 'overdue' | 'current' | 'rejected'

const STATUS: Record<PortalStatusKind, { icon: string; label: string; className: string }> = {
  paid: { icon: '✅', label: 'お支払い済み', className: 'text-emerald-700' },
  pending: { icon: '⏳', label: '確認中', className: 'text-amber-700' },
  overdue: { icon: '⚠️', label: 'お支払いが遅れています', className: 'text-destructive' },
  current: { icon: '', label: '今月分', className: 'text-slate-600' },
  rejected: { icon: '❌', label: '確認できませんでした', className: 'text-destructive' },
}

export function StatusBadge({ kind, className = '' }: { kind: PortalStatusKind; className?: string }) {
  const s = STATUS[kind]
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${s.className} ${className}`}>
      {s.icon && <span aria-hidden>{s.icon}</span>}
      {s.label}
    </span>
  )
}
