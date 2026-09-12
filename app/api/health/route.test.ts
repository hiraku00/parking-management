import { describe, expect, it } from 'vitest'
import { GET } from './route'

describe('GET /api/health', () => {
  it('200と { status: "ok" } を返す', async () => {
    const response = GET()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })
})
