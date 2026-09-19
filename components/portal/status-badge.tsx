import { portalStatus, type PortalStatusKind } from '@/lib/design/status'

/**
 * 契約者ポータルで使う状態表示。色だけに頼らず、必ずアイコン＋文字で示す
 * （docs/design/07-screens.md §7.1、docs/design/10-design-system.md §10.2/U1）。
 */
export type { PortalStatusKind }

export function StatusBadge({ kind, className = '' }: { kind: PortalStatusKind; className?: string }) {
  const s = portalStatus(kind)
  const Icon = s.icon
  return (
    <span className={`status-pill status-pill--${s.tone} ${className}`}>
      <Icon className="ico" />
      {s.label}
    </span>
  )
}
