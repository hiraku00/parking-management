/**
 * 金額はすべて整数の円（税込・内税）で扱う。
 * 参照: docs/design/04-data-model.md §4.2, docs/design/06-billing-payments.md §6.8
 */

/** "¥3,000" のように3桁区切りで表示する。 */
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`
}

/** 内税額を計算する: floor(amount * rate / (100 + rate))。
 *  1枚の領収書・1件の金額につき1回だけ端数処理する（複数回に分けて丸めない）。 */
export function includedTax(amount: number, taxRatePercent: number): number {
  return Math.floor((amount * taxRatePercent) / (100 + taxRatePercent))
}
