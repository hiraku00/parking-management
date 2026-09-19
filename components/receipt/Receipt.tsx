import type { IssuerSnapshot } from '@/lib/db/schema'
import { formatYen } from '@/lib/domain/money'
import { formatDateJa } from '@/lib/domain/time'

/**
 * 契約者ポータル・管理画面の両方の領収書表示から使う共通コンポーネント。
 * 印刷（ブラウザの印刷機能でPDF保存も可能）を前提に、A5横/A4で収まる
 * シンプルな1枚のレイアウトにする。参照: docs/design/06-billing-payments.md §6.8
 */
export function Receipt(props: {
  receiptNo: number
  issuedAt: Date
  transactionDate: string
  recipientName: string
  description: string
  amount: number
  taxRate: number
  taxAmount: number
  paymentMethodLabel: string
  issuer: IssuerSnapshot
  kind?: 'receipt' | 'credit_note'
}) {
  const isCreditNote = props.kind === 'credit_note'
  const title = isCreditNote
    ? props.issuer.registrationNumber
      ? '返金領収書（適格返還請求書）'
      : '返金領収書'
    : props.issuer.registrationNumber
      ? '領収書（適格簡易請求書）'
      : '領収書'

  return (
    <div className="mx-auto max-w-2xl border border-slate-300 bg-white p-8 print:border-0 print:p-0">
      <div className="flex items-start justify-between border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">No. {String(props.receiptNo).padStart(6, '0')}</p>
      </div>

      <p className="mt-6 text-lg text-slate-900">{props.recipientName} 様</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{formatYen(props.amount)}-</p>
      <p className="text-sm text-slate-500">（税込）</p>
      <p className="mt-4 text-base text-slate-900">但し {props.description} として</p>

      <div className="mt-4 space-y-1 border-t pt-4 text-sm text-slate-700">
        <p>
          {props.taxRate}%対象 {formatYen(props.amount)}（うち消費税 {formatYen(props.taxAmount)}）
        </p>
        <p>取引日: {props.transactionDate}</p>
        <p>発行日: {formatDateJa(props.issuedAt)}</p>
        <p>お支払い方法: {props.paymentMethodLabel}</p>
      </div>

      <div className="mt-8 space-y-0.5 border-t pt-4 text-sm text-slate-700">
        <p className="font-medium text-slate-900">{props.issuer.businessName}</p>
        <p>{props.issuer.address}</p>
        {props.issuer.phone && <p>TEL: {props.issuer.phone}</p>}
        {props.issuer.registrationNumber && <p>登録番号: {props.issuer.registrationNumber}</p>}
      </div>
    </div>
  )
}
