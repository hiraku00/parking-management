import { describe, expect, it } from 'vitest'
import { signContractorSession, verifyContractorSession } from './contractor-session'

const SECRET = 'test-secret-at-least-32-bytes-long-xxxxx'

describe('signContractorSession / verifyContractorSession', () => {
  it('署名したトークンを正しく検証できる', async () => {
    const token = await signContractorSession(SECRET, 'contractor-1', 3)
    const claims = await verifyContractorSession(SECRET, token)
    expect(claims).toEqual({ sub: 'contractor-1', sv: 3 })
  })

  it('違う鍵で署名されたトークンは検証に失敗する', async () => {
    const token = await signContractorSession(SECRET, 'contractor-1', 1)
    const claims = await verifyContractorSession('different-secret-xxxxxxxxxxxxxxxxxxxxxxx', token)
    expect(claims).toBeNull()
  })

  it('壊れたトークンは検証に失敗する', async () => {
    const claims = await verifyContractorSession(SECRET, 'not-a-jwt')
    expect(claims).toBeNull()
  })
})
