import { describe, expect, it } from 'vitest'
import { generateLoginToken, hashLoginToken } from './login-token'

describe('generateLoginToken', () => {
  it('32バイト（base64urlで43文字、パディング無し）のトークンを生成する', () => {
    const token = generateLoginToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('毎回異なるトークンを生成する', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateLoginToken()))
    expect(tokens.size).toBe(20)
  })
})

describe('hashLoginToken', () => {
  it('同じトークンからは同じハッシュになる', async () => {
    const token = generateLoginToken()
    expect(await hashLoginToken(token)).toBe(await hashLoginToken(token))
  })

  it('違うトークンからは違うハッシュになる', async () => {
    const a = await hashLoginToken(generateLoginToken())
    const b = await hashLoginToken(generateLoginToken())
    expect(a).not.toBe(b)
  })

  it('ハッシュは元のトークンと異なる（そのまま保存していない）', async () => {
    const token = generateLoginToken()
    expect(await hashLoginToken(token)).not.toBe(token)
  })
})
