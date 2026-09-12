import { describe, expect, it } from 'vitest'
import { formatYen, includedTax } from './money'

describe('formatYen', () => {
  it('3桁区切りで¥記号を付ける', () => {
    expect(formatYen(3000)).toBe('¥3,000')
    expect(formatYen(1000000)).toBe('¥1,000,000')
  })

  it('0や小さい額もそのまま表示する', () => {
    expect(formatYen(0)).toBe('¥0')
    expect(formatYen(500)).toBe('¥500')
  })
})

describe('includedTax', () => {
  it('税率10%の内税額を計算する（設計書記載の例）', () => {
    expect(includedTax(3000, 10)).toBe(272)
    expect(includedTax(9000, 10)).toBe(818)
  })

  it('端数は切り捨てる', () => {
    expect(includedTax(1000, 10)).toBe(90) // 1000*10/110 = 90.909...
  })

  it('0円は0円', () => {
    expect(includedTax(0, 10)).toBe(0)
  })
})
