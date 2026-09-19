/**
 * 状態→(グリフ, 文字, 色)の対応表を1か所に集約する。色だけに頼らず、
 * 必ずアイコン＋文字＋色の3点で示す（U1）。グリフは絵文字ではなく
 * インラインSVG（components/ui/icons.tsx）を使う——OS・フォントで見た目が
 * 変わらず、色・線幅をトークンで統一できるため（docs/design/12-review-followups.md §12.1）。
 * 参照: docs/design/10-design-system.md §10.2, §10.7
 */
import type { ComponentType, SVGProps } from 'react'
import {
  CheckIcon,
  ClockIcon,
  AlertTriangleIcon,
  XIcon,
  DotIcon,
  HalfCircleIcon,
  CircleIcon,
  SlashCircleIcon,
  DashIcon,
} from '@/components/ui/icons'
import type { MatrixCellStatus } from '@/lib/services/queries'

export type StatusTone = 'good' | 'warn' | 'info' | 'danger' | 'muted'
export type StatusIcon = ComponentType<SVGProps<SVGSVGElement>>

export type PortalStatusKind =
  'paid' | 'pending' | 'overdue' | 'rejected' | 'inProgress' | 'needsPayment' | 'refunded'

const PORTAL_STATUS: Record<PortalStatusKind, { icon: StatusIcon; label: string; tone: StatusTone }> = {
  paid: { icon: CheckIcon, label: 'お支払い済み', tone: 'good' },
  pending: { icon: ClockIcon, label: '確認中', tone: 'warn' },
  overdue: { icon: AlertTriangleIcon, label: 'お支払いが遅れています', tone: 'danger' },
  rejected: { icon: XIcon, label: '確認できませんでした', tone: 'danger' },
  inProgress: { icon: ClockIcon, label: 'お手続き中', tone: 'info' },
  needsPayment: { icon: DotIcon, label: 'お支払いをお願いします', tone: 'info' },
  refunded: { icon: SlashCircleIcon, label: '返金済み', tone: 'muted' },
}

export function portalStatus(kind: PortalStatusKind) {
  return PORTAL_STATUS[kind]
}

/** 管理画面の入金マトリクス（`lib/services/queries.ts` の `MatrixCellStatus`）用。 */
const MATRIX_STATUS: Record<MatrixCellStatus, { icon: StatusIcon; label: string; tone: StatusTone }> = {
  paid: { icon: CheckIcon, label: '支払済み', tone: 'good' },
  partial: { icon: HalfCircleIcon, label: '一部入金', tone: 'warn' },
  pending: { icon: ClockIcon, label: '確認中', tone: 'warn' },
  overdue: { icon: AlertTriangleIcon, label: '滞納', tone: 'danger' },
  unpaid: { icon: CircleIcon, label: '未払い', tone: 'muted' },
  void: { icon: SlashCircleIcon, label: '免除', tone: 'muted' },
  not_applicable: { icon: DashIcon, label: '対象外', tone: 'muted' },
}

export function matrixStatus(kind: MatrixCellStatus) {
  return MATRIX_STATUS[kind]
}

export const MATRIX_STATUS_ORDER: MatrixCellStatus[] = [
  'paid',
  'partial',
  'pending',
  'overdue',
  'unpaid',
  'void',
  'not_applicable',
]
