import { describe, expect, it } from 'vitest'
import { normalizeName } from './names'

describe('normalizeName', () => {
  it('全角スペースと半角スペースはどちらも除去され、同じキーになる', () => {
    expect(normalizeName('田中　太郎')).toBe('田中太郎') // 全角スペース
    expect(normalizeName('田中 太郎')).toBe('田中太郎') // 半角スペース
    expect(normalizeName('田中太郎')).toBe('田中太郎') // スペースなし
  })

  it('前後・複数のスペースも除去する', () => {
    expect(normalizeName('  田中  太郎  ')).toBe('田中太郎')
  })

  it('全角英数字は半角に正規化される', () => {
    expect(normalizeName('Ａ－３号室')).toBe(normalizeName('A-3号室'))
  })

  it('空文字は空文字のまま', () => {
    expect(normalizeName('')).toBe('')
  })
})
