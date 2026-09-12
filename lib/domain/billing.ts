import { addMonths, compareYearMonth, monthsBetween, type YearMonth } from './time'

/**
 * 契約者に対して請求を作るべき月の一覧を返す。
 * 上限は「当月 + 前払いの月数（invoiceLeadMonths）」と「契約終了月」の早い方。
 * 参照: docs/design/06-billing-payments.md §6.2
 */
export function billableMonths(params: {
  contractStartMonth: YearMonth
  contractEndMonth: YearMonth | null
  currentMonth: YearMonth
  invoiceLeadMonths: number
}): YearMonth[] {
  const leadUpperBound = addMonths(params.currentMonth, params.invoiceLeadMonths)
  const upperBound =
    params.contractEndMonth && compareYearMonth(params.contractEndMonth, leadUpperBound) < 0
      ? params.contractEndMonth
      : leadUpperBound
  return monthsBetween(params.contractStartMonth, upperBound)
}

export type AllocationTarget = { id: string; remaining: number }
export type Allocation = { invoiceId: string; amount: number }

/**
 * 入金額を、古い月から順に渡された請求の残額へ充てていく。
 * 呼び出し側が invoices を古い月順（昇順）に渡すことを前提にする。
 * 合計が amount とちょうど一致するように配分し、請求の残額合計を超える
 * amount が渡された場合はエラーにする（呼び出し側で防ぐべき状態のため）。
 */
export function allocate(invoices: AllocationTarget[], amount: number): Allocation[] {
  let remainingToAllocate = amount
  const allocations: Allocation[] = []

  for (const invoice of invoices) {
    if (remainingToAllocate <= 0) break
    const applied = Math.min(remainingToAllocate, invoice.remaining)
    if (applied > 0) {
      allocations.push({ invoiceId: invoice.id, amount: applied })
      remainingToAllocate -= applied
    }
  }

  if (remainingToAllocate > 0) {
    throw new Error(
      `allocate: amount ${amount} exceeds the total remaining balance across the given invoices`,
    )
  }

  return allocations
}
