/**
 * 業務日付はすべて Asia/Tokyo (JST, UTC+9固定・夏時間なし) で判定する。
 * `new Date().toISOString()` 等のUTC基準の関数は、JSTの月初0〜9時を
 * 前月として扱ってしまう不具合の元になるため、このファイル以外では使わない。
 * 参照: docs/design/02-review-findings.md R16, docs/design/06-billing-payments.md §6.1
 */

export type YearMonth = `${number}-${string}`

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/** UTCのDateを、JSTの壁時計時刻を表すDateに変換する（値そのものはUTCのまま、
 *  getUTCFullYear() 等でJSTのフィールドを読めるようにするための平行移動）。 */
function toJstFields(date: Date): Date {
  return new Date(date.getTime() + JST_OFFSET_MS)
}

/** JSTでの「今日」を YYYY-MM-DD で返す。 */
export function todayJst(now: Date): string {
  const jst = toJstFields(now)
  const y = jst.getUTCFullYear()
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0')
  const d = String(jst.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** JSTでの「今月」を YYYY-MM で返す。 */
export function currentMonth(now: Date): YearMonth {
  return todayJst(now).slice(0, 7) as YearMonth
}

/** YYYY-MM の妥当性を検証する（月は 01-12）。 */
export function isValidYearMonth(value: string): value is YearMonth {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

/** YYYY-MM-DD の妥当性を検証する（うるう年・月末日を含めてカレンダー上実在する日付か確認する）。 */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function toYearMonth(year: number, monthIndex0: number): YearMonth {
  // Math.trunc は 0 方向への丸めなので、monthIndex0 が負のとき年の繰り下がりを
  // 取りこぼす（例: -1 を渡すと 0 になってしまう）。年をまたぐ減算のため floor を使う。
  const y = Math.floor(monthIndex0 / 12)
  const m = ((monthIndex0 % 12) + 12) % 12
  return `${year + y}-${String(m + 1).padStart(2, '0')}` as YearMonth
}

/** ym の n か月後（nが負なら前）の年月を返す。年またぎも正しく扱う。
 *  Date同士の演算は使わず、整数演算だけで計算する（DST等の混入を避けるため）。 */
export function addMonths(ym: YearMonth, n: number): YearMonth {
  const [year, month] = ym.split('-').map(Number)
  return toYearMonth(year, month - 1 + n)
}

/** 2つの年月を比較する（from < to なら負、等しければ0、from > to なら正）。 */
export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** from から to までの年月を、両端を含めて昇順で返す。from > to なら空配列。 */
export function monthsBetween(from: YearMonth, to: YearMonth): YearMonth[] {
  if (compareYearMonth(from, to) > 0) return []
  const months: YearMonth[] = []
  let cursor = from
  // ガード: 呼び出し側の不具合で範囲が異常に長い場合に無限ループ化しないようにする
  for (let i = 0; i < 1200 && compareYearMonth(cursor, to) <= 0; i++) {
    months.push(cursor)
    cursor = addMonths(cursor, 1)
  }
  return months
}

const MONTH_LABELS_JA = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
]

/** "2026-09" -> "2026年9月" */
export function formatMonthJa(ym: YearMonth): string {
  const [year, month] = ym.split('-').map(Number)
  return `${year}年${MONTH_LABELS_JA[month - 1]}`
}

/** JSTの日付 (Date) を "2026年9月12日" の形式で表示する。 */
export function formatDateJa(date: Date): string {
  const jst = toJstFields(date)
  return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`
}
