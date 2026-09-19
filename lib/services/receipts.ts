import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import type { IssuerSnapshot } from '../db/schema'
import { PAYMENT_METHODS } from '../db/schema'
import { includedTax } from '../domain/money'
import { formatMonthJa, type YearMonth } from '../domain/time'

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  card: 'クレジットカード等',
  bank_transfer: '銀行振込',
  cash: '現金',
  other: 'その他',
}

/** 但し書きを組み立てる: "駐車場使用料 2026年10月分〜2026年12月分（区画A-3）"。 */
export function buildReceiptDescription(params: {
  months: YearMonth[]
  spaceLabel: string | null
  isPartial: boolean
}): string {
  const sorted = [...params.months].sort()
  const range =
    sorted.length === 1
      ? `${formatMonthJa(sorted[0])}分`
      : `${formatMonthJa(sorted[0])}分〜${formatMonthJa(sorted[sorted.length - 1])}分`
  const space = params.spaceLabel ? `（区画${params.spaceLabel}）` : ''
  const partial = params.isPartial ? '（一部）' : ''
  return `駐車場使用料 ${range}${space}${partial}`
}

/** 返金（適格返還請求書）の但し書き。参照: docs/design/12-review-followups.md §12.2 */
export function buildCreditNoteDescription(params: {
  months: YearMonth[]
  spaceLabel: string | null
}): string {
  const sorted = [...params.months].sort()
  const range =
    sorted.length === 1
      ? `${formatMonthJa(sorted[0])}分`
      : `${formatMonthJa(sorted[0])}分〜${formatMonthJa(sorted[sorted.length - 1])}分`
  const space = params.spaceLabel ? `（区画${params.spaceLabel}）` : ''
  return `駐車場使用料 ${range}${space} の返金`
}

/**
 * 入金が succeeded になるのと同じbatchに含める。連番は
 * `COALESCE(MAX(receipt_no),0)+1` をSQLite側で採番することで、書き込みが
 * 直列なD1上で安全に一意になる。`INSERT OR IGNORE` により、同じ入金に対して
 * 二重に呼ばれても（Webhookの再送等）2枚目は挿入されない（冪等）。
 * `WHERE p.status = 'succeeded'` は、同じbatch内の直前の
 * UPDATE payments SET status='succeeded' が反映された後にだけ発行されるようにする
 * ガード（バッチ内の各文は同一トランザクションで順番に実行される）。
 * 参照: docs/design/06-billing-payments.md §6.8, docs/design/04-data-model.md §4.6
 */
export function issueReceiptStatement(
  db: Db,
  params: {
    paymentId: string
    now: Date
    transactionDate: string
    recipientName: string
    description: string
    amount: number
    taxRate: number
    paymentMethodLabel: string
    issuer: IssuerSnapshot
    /** 'receipt'=通常の領収書（既定） / 'credit_note'=返金時の適格返還請求書 */
    kind?: 'receipt' | 'credit_note'
    /** この入金の状態がこれと一致するときだけ発行する（既定 'succeeded'）。
     *  返還請求書は 'refunded' になった直後に発行するため 'refunded' を渡す。 */
    expectedStatus?: 'succeeded' | 'refunded'
  },
) {
  const kind = params.kind ?? 'receipt'
  const expectedStatus = params.expectedStatus ?? 'succeeded'
  const taxAmount = includedTax(params.amount, params.taxRate)
  const id = crypto.randomUUID()
  return db.run(sql`
    INSERT OR IGNORE INTO receipts
      (id, receipt_no, kind, payment_id, issued_at, transaction_date, recipient_name, description, amount, tax_rate, tax_amount, payment_method_label, issuer, created_at)
    SELECT ${id}, COALESCE((SELECT MAX(receipt_no) FROM receipts), 0) + 1, ${kind}, p.id, ${params.now.getTime()}, ${params.transactionDate},
      ${params.recipientName}, ${params.description}, ${params.amount}, ${params.taxRate}, ${taxAmount}, ${params.paymentMethodLabel},
      ${JSON.stringify(params.issuer)}, ${params.now.getTime()}
    FROM payments p WHERE p.id = ${params.paymentId} AND p.status = ${expectedStatus}
  `)
}
