import { describe, expect, it } from 'vitest'
import { deriveHomeState, type HomeInvoice } from './portal-home'

function inv(month: string, remaining: number, timing: HomeInvoice['timing'], pending = false): HomeInvoice {
  return { id: `inv-${month}`, month: month as HomeInvoice['month'], remaining, timing, pending }
}

describe('deriveHomeState', () => {
  it('カード決済が途中なら、他の状態より優先して card_in_progress を返す', () => {
    const state = deriveHomeState({
      invoices: [inv('2026-09', 3000, 'overdue')],
      pendingCardPayment: { paymentId: 'p1', months: ['2026-08'], amount: 3000 },
      latestRejected: { paymentId: 'p2', months: ['2026-07'], reason: '入金が確認できません' },
    })
    expect(state).toEqual({ kind: 'card_in_progress', paymentId: 'p1', months: ['2026-08'], amount: 3000 })
  })

  it('却下された月がまだ未払いのままなら rejected を返す', () => {
    const state = deriveHomeState({
      invoices: [inv('2026-09', 3000, 'current')],
      pendingCardPayment: null,
      latestRejected: { paymentId: 'p2', months: ['2026-09'], reason: '入金が確認できません' },
    })
    expect(state).toEqual({
      kind: 'rejected',
      paymentId: 'p2',
      months: ['2026-09'],
      reason: '入金が確認できません',
    })
  })

  it('却下された月が既に別の方法で支払い済みなら rejected を出さず、次の状態に進む', () => {
    const state = deriveHomeState({
      invoices: [],
      pendingCardPayment: null,
      latestRejected: { paymentId: 'p2', months: ['2026-09'], reason: '理由' },
    })
    expect(state).toEqual({ kind: 'all_paid', nextMonth: null })
  })

  it('却下された月が再報告でpending中なら rejected を出さない', () => {
    const state = deriveHomeState({
      invoices: [inv('2026-09', 3000, 'current', true)],
      pendingCardPayment: null,
      latestRejected: { paymentId: 'p2', months: ['2026-09'], reason: '理由' },
    })
    expect(state.kind).toBe('waiting_confirmation')
  })

  it('今月・滞納分（pendingでない）があれば needs_payment を返し、前払い分は合計に含めない', () => {
    const state = deriveHomeState({
      invoices: [
        inv('2026-08', 3000, 'overdue'),
        inv('2026-09', 3000, 'current'),
        inv('2026-10', 3000, 'future'),
      ],
      pendingCardPayment: null,
      latestRejected: null,
    })
    expect(state).toEqual({
      kind: 'needs_payment',
      overdue: true,
      months: ['2026-08', '2026-09'],
      amount: 6000,
    })
  })

  it('滞納が無く今月分だけなら overdue=false', () => {
    const state = deriveHomeState({
      invoices: [inv('2026-09', 3000, 'current')],
      pendingCardPayment: null,
      latestRejected: null,
    })
    expect(state).toEqual({ kind: 'needs_payment', overdue: false, months: ['2026-09'], amount: 3000 })
  })

  it('支払いが必要な月が無く、確認中の月があれば waiting_confirmation を返す', () => {
    const state = deriveHomeState({
      invoices: [inv('2026-09', 3000, 'current', true), inv('2026-10', 3000, 'future')],
      pendingCardPayment: null,
      latestRejected: null,
    })
    expect(state).toEqual({ kind: 'waiting_confirmation', months: ['2026-09'] })
  })

  it('未払いが無ければ all_paid（前払い対象があれば nextMonth に入れる）', () => {
    const state = deriveHomeState({
      invoices: [inv('2026-10', 3000, 'future')],
      pendingCardPayment: null,
      latestRejected: null,
    })
    expect(state).toEqual({ kind: 'all_paid', nextMonth: { month: '2026-10', amount: 3000 } })
  })

  it('請求が何も無ければ all_paid（nextMonthはnull）', () => {
    const state = deriveHomeState({ invoices: [], pendingCardPayment: null, latestRejected: null })
    expect(state).toEqual({ kind: 'all_paid', nextMonth: null })
  })
})
