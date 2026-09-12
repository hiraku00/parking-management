import { describe, expect, it } from 'vitest'
import { originFromHeaders } from './origin'

describe('originFromHeaders', () => {
  it('x-forwarded-proto があればそれを使う（本番のCloudflare環境）', () => {
    const headers = new Headers({
      host: 'parking-management.hiraku00.workers.dev',
      'x-forwarded-proto': 'https',
    })
    expect(originFromHeaders(headers)).toBe('https://parking-management.hiraku00.workers.dev')
  })

  it('localhostでx-forwarded-protoが無ければhttpにする（ローカル開発）', () => {
    const headers = new Headers({ host: 'localhost:3210' })
    expect(originFromHeaders(headers)).toBe('http://localhost:3210')
  })

  it('127.0.0.1もローカルとして扱う', () => {
    const headers = new Headers({ host: '127.0.0.1:3210' })
    expect(originFromHeaders(headers)).toBe('http://127.0.0.1:3210')
  })

  it('localhost以外でx-forwarded-protoが無ければhttpsにする', () => {
    const headers = new Headers({ host: 'example.com' })
    expect(originFromHeaders(headers)).toBe('https://example.com')
  })
})
