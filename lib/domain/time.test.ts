import { describe, expect, it } from 'vitest'
import {
  addMonths,
  compareYearMonth,
  currentMonth,
  formatDateJa,
  formatDueDateJa,
  formatMonthJa,
  isPastDue,
  isValidIsoDate,
  isValidYearMonth,
  monthsBetween,
  todayJst,
} from './time'

describe('todayJst', () => {
  it('JST 00:00ちょうど（UTC前日15:00）は当日の日付になる', () => {
    expect(todayJst(new Date('2025-12-31T15:00:00.000Z'))).toBe('2026-01-01')
  })

  it('JSTの1ミリ秒前（UTC前日14:59:59.999）はまだ前日', () => {
    expect(todayJst(new Date('2025-12-31T14:59:59.999Z'))).toBe('2025-12-31')
  })

  it('通常の日中はそのままJSTの日付になる', () => {
    expect(todayJst(new Date('2026-06-15T03:00:00.000Z'))).toBe('2026-06-15')
  })
})

describe('currentMonth', () => {
  it('月初のJST 00:00ちょうど（UTC前月末15:00）で当月に切り替わる', () => {
    expect(currentMonth(new Date('2026-01-31T15:00:00.000Z'))).toBe('2026-02')
  })

  it('切り替わりの1ミリ秒前はまだ前月', () => {
    expect(currentMonth(new Date('2026-01-31T14:59:59.999Z'))).toBe('2026-01')
  })

  it('年またぎの月初も正しく切り替わる', () => {
    expect(currentMonth(new Date('2025-12-31T15:00:00.000Z'))).toBe('2026-01')
    expect(currentMonth(new Date('2025-12-31T14:59:59.999Z'))).toBe('2025-12')
  })
})

describe('isValidYearMonth', () => {
  it.each(['2026-01', '2026-09', '2026-12', '9999-12'])('%s は妥当な年月', (v) => {
    expect(isValidYearMonth(v)).toBe(true)
  })

  it.each(['2026-00', '2026-13', '2026-1', '2026/01', '2026-01-01', ''])('%s は不正な年月', (v) => {
    expect(isValidYearMonth(v)).toBe(false)
  })
})

describe('isValidIsoDate', () => {
  it('実在する日付は妥当', () => {
    expect(isValidIsoDate('2026-01-31')).toBe(true)
    expect(isValidIsoDate('2024-02-29')).toBe(true) // うるう年
  })

  it('カレンダー上存在しない日付は不正', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false) // 2月に30日は無い
    expect(isValidIsoDate('2025-02-29')).toBe(false) // 平年にうるう日は無い
    expect(isValidIsoDate('2026-13-01')).toBe(false)
  })

  it('形式が違えば不正', () => {
    expect(isValidIsoDate('2026-1-1')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
  })
})

describe('addMonths', () => {
  it('同一年内の加減算', () => {
    expect(addMonths('2026-06', 1)).toBe('2026-07')
    expect(addMonths('2026-06', -1)).toBe('2026-05')
  })

  it('年をまたぐ加算', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
  })

  it('年をまたぐ減算', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  it('複数年にまたがる加減算', () => {
    expect(addMonths('2026-06', 19)).toBe('2028-01')
    expect(addMonths('2026-06', -19)).toBe('2024-11')
  })

  it('0か月後は変化なし', () => {
    expect(addMonths('2026-06', 0)).toBe('2026-06')
  })
})

describe('compareYearMonth', () => {
  it('前後関係を正しく返す', () => {
    expect(compareYearMonth('2026-01', '2026-02')).toBeLessThan(0)
    expect(compareYearMonth('2026-02', '2026-01')).toBeGreaterThan(0)
    expect(compareYearMonth('2026-01', '2026-01')).toBe(0)
  })
})

describe('monthsBetween', () => {
  it('両端を含む昇順の配列を返す', () => {
    expect(monthsBetween('2026-01', '2026-01')).toEqual(['2026-01'])
    expect(monthsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })

  it('from が to より後なら空配列', () => {
    expect(monthsBetween('2026-02', '2026-01')).toEqual([])
  })
})

describe('formatMonthJa', () => {
  it('年月を日本語表記にする', () => {
    expect(formatMonthJa('2026-01')).toBe('2026年1月')
    expect(formatMonthJa('2026-09')).toBe('2026年9月')
    expect(formatMonthJa('2026-12')).toBe('2026年12月')
  })
})

describe('formatDateJa', () => {
  it('JSTの日付として日本語表記にする', () => {
    // UTC 2026-01-01T00:00Z は JST 2026-01-01 09:00
    expect(formatDateJa(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026年1月1日')
    // UTC前日15:00はJST翌日0:00
    expect(formatDateJa(new Date('2025-12-31T15:00:00.000Z'))).toBe('2026年1月1日')
  })
})

describe('formatDueDateJa', () => {
  it('dueDayが指定されていればその日を表示する', () => {
    expect(formatDueDateJa('2026-09', 5)).toBe('9月5日')
  })

  it('dueDayがNULLなら月末日を表示する（うるう年を含む）', () => {
    expect(formatDueDateJa('2026-09', null)).toBe('9月30日')
    expect(formatDueDateJa('2026-02', null)).toBe('2月28日')
    expect(formatDueDateJa('2024-02', null)).toBe('2月29日') // うるう年
  })
})

describe('isPastDue', () => {
  const now = new Date('2026-09-15T00:00:00.000Z') // JST 2026-09-15

  it('前月以前はdueDayに関わらず常に滞納扱い', () => {
    expect(isPastDue('2026-08', now, null)).toBe(true)
    expect(isPastDue('2026-08', now, 28)).toBe(true)
  })

  it('来月以降はdueDayに関わらず滞納にならない', () => {
    expect(isPastDue('2026-10', now, 1)).toBe(false)
  })

  it('dueDayがNULLなら当月中は滞納にならない（月末扱い）', () => {
    expect(isPastDue('2026-09', now, null)).toBe(false)
  })

  it('当月分はdueDayを過ぎていれば滞納、過ぎていなければ滞納にならない', () => {
    expect(isPastDue('2026-09', now, 10)).toBe(true) // 期日9/10を過ぎている
    expect(isPastDue('2026-09', now, 15)).toBe(false) // 当日は期日当日でまだ滞納にしない
    expect(isPastDue('2026-09', now, 20)).toBe(false) // 期日はまだ先
  })
})
