import type { YearMonth } from './time'

/**
 * 契約者ポータルのホーム画面に表示する「今の状態」を1つだけ決める。
 * 優先順位: カード決済の途中 > 直近の却下（未解決なら）> 支払いが必要 >
 * 確認待ち > 支払い済み。ホームは常にこの1状態だけを主に表示し、
 * 主なボタンも1つに絞る（docs/design/09-ux-improvements.md §9.3, §9.4.1）。
 */

export type HomeInvoice = {
  id: string
  month: YearMonth
  remaining: number
  /** 今月より前 / 今月 / 前払い対象（来月以降） */
  timing: 'overdue' | 'current' | 'future'
  /** 確認中の入金（カードのpending・銀行振込のpending）が付いているか */
  pending: boolean
}

export type PendingCardPayment = { paymentId: string; months: YearMonth[]; amount: number }
export type RejectedTransfer = { paymentId: string; months: YearMonth[]; reason: string | null }

export type HomeState =
  | { kind: 'card_in_progress'; paymentId: string; months: YearMonth[]; amount: number }
  | { kind: 'rejected'; paymentId: string; months: YearMonth[]; reason: string | null }
  | { kind: 'needs_payment'; overdue: boolean; months: YearMonth[]; amount: number }
  | { kind: 'waiting_confirmation'; months: YearMonth[] }
  | { kind: 'all_paid'; nextMonth: { month: YearMonth; amount: number } | null }

export function deriveHomeState(input: {
  invoices: HomeInvoice[]
  pendingCardPayment: PendingCardPayment | null
  latestRejected: RejectedTransfer | null
}): HomeState {
  if (input.pendingCardPayment) {
    return { kind: 'card_in_progress', ...input.pendingCardPayment }
  }

  if (input.latestRejected) {
    // 却下された月が、まだ未払いのまま（再報告も再決済もされていない）なら表示する。
    // 一部でも支払い済み・再度pending中なら、この却下はもう古い情報なので出さない。
    const stillUnresolved = input.latestRejected.months.every((month) => {
      const invoice = input.invoices.find((i) => i.month === month)
      return invoice !== undefined && !invoice.pending
    })
    if (stillUnresolved) {
      return { kind: 'rejected', ...input.latestRejected }
    }
  }

  const duePayable = input.invoices.filter((i) => i.timing !== 'future' && !i.pending)
  if (duePayable.length > 0) {
    return {
      kind: 'needs_payment',
      overdue: duePayable.some((i) => i.timing === 'overdue'),
      months: duePayable.map((i) => i.month),
      amount: duePayable.reduce((sum, i) => sum + i.remaining, 0),
    }
  }

  const pendingInvoices = input.invoices.filter((i) => i.pending)
  if (pendingInvoices.length > 0) {
    return { kind: 'waiting_confirmation', months: pendingInvoices.map((i) => i.month) }
  }

  const future = input.invoices.find((i) => i.timing === 'future')
  return { kind: 'all_paid', nextMonth: future ? { month: future.month, amount: future.remaining } : null }
}
