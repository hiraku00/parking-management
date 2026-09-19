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

/**
 * 複数月をまとめて表示するときの表記。1〜2件は "2026年7月と2026年8月" と列挙し、
 * 3件以上は "2026年7月〜9月"（年をまたぐ場合は "2026年12月〜2027年2月"）と
 * 範囲でまとめる。"○月と○月と○月と○月" の連続表記は年をまたぐたびに読みにくく
 * なるため（高齢の利用者を含む契約者ポータルの方針 docs/design/07-screens.md §7.1）。
 * `months` は昇順であることを前提とする。
 */
export function formatMonthRangeJa(months: YearMonth[]): string {
  if (months.length === 0) return ''
  if (months.length <= 2) return months.map(formatMonthJa).join('と')

  const first = months[0]
  const last = months[months.length - 1]
  const [firstYear] = first.split('-')
  const [lastYear, lastMonth] = last.split('-')
  const lastLabel = firstYear === lastYear ? MONTH_LABELS_JA[Number(lastMonth) - 1] : formatMonthJa(last)
  return `${formatMonthJa(first)}〜${lastLabel}`
}

/**
 * 指定した月の請求が、支払期日を過ぎているかどうかを判定する。
 * 前月以前はいつでも滞納扱い、来月以降は常に対象外。当月分は `dueDay`
 * （1〜28。NULLは月末）を過ぎたかどうかで判定する。
 * 参照: docs/design/09-ux-improvements.md §9.4.11
 */
export function isPastDue(month: YearMonth, now: Date, dueDay: number | null): boolean {
  const cmp = compareYearMonth(month, currentMonth(now))
  if (cmp < 0) return true
  if (cmp > 0) return false
  if (dueDay === null) return false
  const dueDate = `${month}-${String(dueDay).padStart(2, '0')}`
  return todayJst(now) > dueDate
}

/** 指定した月の支払期日を "9月30日" の形式で表示する（dueDayがNULLなら月末）。 */
export function formatDueDateJa(month: YearMonth, dueDay: number | null): string {
  const [year, monthNum] = month.split('-').map(Number)
  const day = dueDay ?? new Date(Date.UTC(year, monthNum, 0)).getUTCDate()
  return `${monthNum}月${day}日`
}

/** JSTの日付 (Date) を "2026年9月12日" の形式で表示する。 */
export function formatDateJa(date: Date): string {
  const jst = toJstFields(date)
  return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日`
}
