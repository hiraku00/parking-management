'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatMonthRangeJa, type YearMonth } from '@/lib/domain/time'
import { formatYen } from '@/lib/domain/money'

type ExtraInvoice = { month: YearMonth; remaining: number }

/**
 * お支払い ステップ1/2 の範囲選択部分。
 *
 * ①「未払い分」/「未払い分 ＋ 先払い」を同じ名詞句の粒度で選ばせ（どちらにも
 * 未払い分が含まれることを記号で示す）、②「先払い」を選んだときだけ、その
 * 選択肢の内側（インデントした子領域）に先払いする月数のセレクトを出す
 * （1つの `.range-picker` ブロックの中の親子関係として見せる）。③未払い分・
 * 先払い分の内訳と合計は、選択ブロックとは別の白いブロックにまとめる（区切り線
 * のみで役割の違いを示す）。この3点は条件付き表示と合計の即時反映が要るため、
 * method-form.tsx と同じ方針でクライアントコンポーネントにしている
 * （GETフォームでの送信自体はサーバーコンポーネントと同じ仕組みのまま）。
 * 参照: docs/design/12-review-followups.md §12.4
 */
export function PrepaySelector({
  neededCount,
  owedAmount,
  owedMonthsLabel,
  extraInvoices,
  defaultCount,
}: {
  neededCount: number
  owedAmount: number
  owedMonthsLabel: string
  extraInvoices: ExtraInvoice[]
  defaultCount: number
}) {
  const [mode, setMode] = useState<'owed' | 'prepay'>(defaultCount > neededCount ? 'prepay' : 'owed')
  const [months, setMonths] = useState(
    Math.max(1, Math.min(extraInvoices.length, defaultCount - neededCount)),
  )

  const selectedExtra = extraInvoices.slice(0, months)
  const extraAmount = selectedExtra.reduce((sum, i) => sum + i.remaining, 0)
  const extraMonthsLabel = formatMonthRangeJa(selectedExtra.map((i) => i.month))
  const totalAmount = mode === 'prepay' ? owedAmount + extraAmount : owedAmount
  const count = mode === 'prepay' ? neededCount + months : neededCount

  return (
    <form action="/portal/pay/method" method="get" className="space-y-6">
      <input type="hidden" name="count" value={count} />

      <div className="space-y-2">
        <p className="text-lg font-bold text-slate-900">お支払いの範囲</p>
        <fieldset className="range-picker">
          <legend className="sr-only">お支払いの範囲を選んでください</legend>
          <label className="range-picker-row">
            <input type="radio" checked={mode === 'owed'} onChange={() => setMode('owed')} />
            <span className="range-picker-body">
              <span className="title">未払い分</span>
              <span className="sub">{owedMonthsLabel}分</span>
            </span>
            <span className="amount">{formatYen(owedAmount)}</span>
          </label>

          <label className="range-picker-row">
            <input type="radio" checked={mode === 'prepay'} onChange={() => setMode('prepay')} />
            <span className="range-picker-body">
              <span className="title">未払い分 ＋ 先払い</span>
              <span className="sub">来月以降もまとめて</span>
            </span>
          </label>

          {mode === 'prepay' && (
            <div className="range-picker-detail">
              <label htmlFor="prepay-months" className="block text-base font-bold text-slate-900">
                何か月分、先に払いますか？
              </label>
              <select
                id="prepay-months"
                data-slot="input"
                className="mt-2 h-14 w-full text-lg"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
              >
                {extraInvoices.map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}か月分（{formatMonthRangeJa(extraInvoices.slice(0, i + 1).map((inv) => inv.month))}
                    分）
                  </option>
                ))}
              </select>
            </div>
          )}
        </fieldset>
      </div>

      <div className="space-y-2">
        <p className="text-lg font-bold text-slate-900">お支払いいただく金額</p>
        <div className="divide-y divide-[var(--line)] rounded-2xl border border-white/90 bg-[var(--surface)] px-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-base font-bold text-slate-900">未払い分</p>
              <p className="text-base text-muted-foreground">{owedMonthsLabel}分</p>
            </div>
            <p className="text-lg font-bold tabular-nums text-slate-900">{formatYen(owedAmount)}</p>
          </div>

          {mode === 'prepay' && (
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-base font-bold text-slate-900">先払い分</p>
                <p className="text-base text-muted-foreground">{extraMonthsLabel}分</p>
              </div>
              <p className="text-lg font-bold tabular-nums text-slate-900">{formatYen(extraAmount)}</p>
            </div>
          )}

          <div className="flex items-center justify-between py-3">
            <p className="text-lg font-bold text-slate-900">合計</p>
            <p className="amount">{formatYen(totalAmount)}</p>
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" className="h-14 w-full text-lg font-bold">
        次へ
      </Button>
    </form>
  )
}
