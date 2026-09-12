import { describe, expect, it } from 'vitest'
import { allocate, billableMonths } from './billing'

describe('billableMonths', () => {
  it('前払いなし（invoiceLeadMonths=0）なら当月までの請求を作る', () => {
    expect(
      billableMonths({
        contractStartMonth: '2026-07',
        contractEndMonth: null,
        currentMonth: '2026-09',
        invoiceLeadMonths: 0,
      }),
    ).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('前払いあり（invoiceLeadMonths=1）なら翌月分まで作る', () => {
    expect(
      billableMonths({
        contractStartMonth: '2026-09',
        contractEndMonth: null,
        currentMonth: '2026-09',
        invoiceLeadMonths: 1,
      }),
    ).toEqual(['2026-09', '2026-10'])
  })

  it('契約終了月が前払いの上限より早ければ、契約終了月で止める', () => {
    expect(
      billableMonths({
        contractStartMonth: '2026-07',
        contractEndMonth: '2026-09',
        currentMonth: '2026-09',
        invoiceLeadMonths: 1,
      }),
    ).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('契約終了月が前払いの上限より後なら、前払いの上限で止める', () => {
    expect(
      billableMonths({
        contractStartMonth: '2026-07',
        contractEndMonth: '2027-12',
        currentMonth: '2026-09',
        invoiceLeadMonths: 1,
      }),
    ).toEqual(['2026-07', '2026-08', '2026-09', '2026-10'])
  })

  it('契約開始が未来（当月+前払い分より後）なら空になる', () => {
    expect(
      billableMonths({
        contractStartMonth: '2027-01',
        contractEndMonth: null,
        currentMonth: '2026-09',
        invoiceLeadMonths: 1,
      }),
    ).toEqual([])
  })
})

describe('allocate', () => {
  it('一部入金: 1件の請求の残額に満たない額を充てる', () => {
    expect(allocate([{ id: 'inv-1', remaining: 3000 }], 1500)).toEqual([{ invoiceId: 'inv-1', amount: 1500 }])
  })

  it('複数の請求にまたがる入金を、古い順に埋めていく', () => {
    expect(
      allocate(
        [
          { id: 'inv-1', remaining: 1000 },
          { id: 'inv-2', remaining: 1000 },
          { id: 'inv-3', remaining: 1000 },
        ],
        1500,
      ),
    ).toEqual([
      { invoiceId: 'inv-1', amount: 1000 },
      { invoiceId: 'inv-2', amount: 500 },
    ])
  })

  it('ちょうど残額分を全て充てると、残りの請求には配分しない', () => {
    expect(
      allocate(
        [
          { id: 'inv-1', remaining: 1000 },
          { id: 'inv-2', remaining: 1000 },
        ],
        1000,
      ),
    ).toEqual([{ invoiceId: 'inv-1', amount: 1000 }])
  })

  it('超過: 請求の残額合計を超える金額はエラーにする', () => {
    expect(() => allocate([{ id: 'inv-1', remaining: 1000 }], 1500)).toThrow()
  })

  it('空: 請求が無く金額も0なら空配列を返す', () => {
    expect(allocate([], 0)).toEqual([])
  })

  it('空: 請求が無いのに金額があればエラーにする', () => {
    expect(() => allocate([], 1000)).toThrow()
  })

  it('残額が0の請求はスキップする', () => {
    expect(
      allocate(
        [
          { id: 'inv-1', remaining: 0 },
          { id: 'inv-2', remaining: 1000 },
        ],
        1000,
      ),
    ).toEqual([{ invoiceId: 'inv-2', amount: 1000 }])
  })
})
