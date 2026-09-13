import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getDb, type Db } from '../db/client'
import { contractors } from '../db/schema'
import { migrate, resetData } from '../../test/support/migrate'
import { insertContractor } from '../../test/support/fixtures'
import { hashLoginToken } from '../auth/login-token'
import { normalizeKana } from '../domain/names'
import {
  attemptContractorLogin,
  attemptQrLogin,
  invalidateContractorSessions,
  reissueLoginToken,
  unlockContractor,
} from './contractor-auth'

let db: Db
const actor = { kind: 'owner' as const, email: 'owner@example.com' }

beforeAll(async () => {
  await migrate(env.DB)
  db = getDb(env.DB)
})

beforeEach(async () => {
  await resetData(env.DB)
})

describe('attemptContractorLogin', () => {
  it('正しい氏名と電話番号下4桁でログインできる', async () => {
    const id = await insertContractor(db, { name: '田中太郎', phoneLast4: '1234' })
    const result = await attemptContractorLogin(db, { name: '田中太郎', phoneLast4: '1234', now: new Date() })
    expect(result).toEqual({ ok: true, contractorId: id, sessionVersion: 1 })
  })

  it('全角/半角の表記ゆれがあってもログインできる', async () => {
    await insertContractor(db, { name: '田中太郎', phoneLast4: '1234' })
    const result = await attemptContractorLogin(db, {
      name: '田中 太郎',
      phoneLast4: '1234',
      now: new Date(),
    })
    expect(result.ok).toBe(true)
  })

  it('存在しない氏名は invalid', async () => {
    const result = await attemptContractorLogin(db, {
      name: '存在しない人',
      phoneLast4: '0000',
      now: new Date(),
    })
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('電話番号が違う場合も invalid（存在しない氏名と同じ文言にするため）', async () => {
    await insertContractor(db, { name: '田中太郎', phoneLast4: '1234' })
    const result = await attemptContractorLogin(db, { name: '田中太郎', phoneLast4: '9999', now: new Date() })
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('氏名で見つからなければフリガナでログインできる', async () => {
    const id = await insertContractor(db, {
      name: '田中太郎',
      nameKana: 'タナカ タロウ',
      loginKanaKey: normalizeKana('タナカ タロウ'),
      phoneLast4: '1234',
    })
    const result = await attemptContractorLogin(db, {
      name: 'たなか たろう',
      phoneLast4: '1234',
      now: new Date(),
    })
    expect(result).toEqual({ ok: true, contractorId: id, sessionVersion: 1 })
  })

  it('フリガナが複数人一致した場合は取り違えを防ぐため invalid', async () => {
    await insertContractor(db, {
      name: '田中太郎',
      nameKana: 'タナカ タロウ',
      loginKanaKey: normalizeKana('タナカ タロウ'),
      phoneLast4: '1234',
    })
    await insertContractor(db, {
      name: '田中太朗',
      nameKana: 'タナカ タロウ',
      loginKanaKey: normalizeKana('タナカ タロウ'),
      phoneLast4: '5678',
    })
    const result = await attemptContractorLogin(db, {
      name: 'タナカタロウ',
      phoneLast4: '1234',
      now: new Date(),
    })
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('アーカイブ済みの契約者はログインできない', async () => {
    await insertContractor(db, { name: '田中太郎', phoneLast4: '1234', archivedAt: new Date() })
    const result = await attemptContractorLogin(db, { name: '田中太郎', phoneLast4: '1234', now: new Date() })
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('5回連続で失敗すると15分ロックされる', async () => {
    const id = await insertContractor(db, { name: '田中太郎', phoneLast4: '1234' })
    const now = new Date('2026-09-15T00:00:00.000Z')

    let result
    for (let i = 0; i < 4; i++) {
      result = await attemptContractorLogin(db, { name: '田中太郎', phoneLast4: '0000', now })
      expect(result).toEqual({ ok: false, reason: 'invalid' })
    }
    // 5回目でロック
    result = await attemptContractorLogin(db, { name: '田中太郎', phoneLast4: '0000', now })
    expect(result).toEqual({ ok: false, reason: 'locked' })

    const row = await db.query.contractors.findFirst({ where: eq(contractors.id, id) })
    expect(row?.lockedUntil?.getTime()).toBe(now.getTime() + 15 * 60 * 1000)
    expect(row?.failedLoginCount).toBe(0)
  })

  it('ロック中は正しい電話番号でもログインできない', async () => {
    await insertContractor(db, { name: '田中太郎', phoneLast4: '1234' })
    const now = new Date('2026-09-15T00:00:00.000Z')
    for (let i = 0; i < 5; i++) {
      await attemptContractorLogin(db, { name: '田中太郎', phoneLast4: '0000', now })
    }
    const result = await attemptContractorLogin(db, {
      name: '田中太郎',
      phoneLast4: '1234',
      now: new Date(now.getTime() + 60 * 1000),
    })
    expect(result).toEqual({ ok: false, reason: 'locked' })
  })

  it('ロック期限を過ぎればログインできる', async () => {
    await insertContractor(db, { name: '田中太郎', phoneLast4: '1234' })
    const now = new Date('2026-09-15T00:00:00.000Z')
    for (let i = 0; i < 5; i++) {
      await attemptContractorLogin(db, { name: '田中太郎', phoneLast4: '0000', now })
    }
    const after = new Date(now.getTime() + 15 * 60 * 1000 + 1000) // 15分1秒後
    const result = await attemptContractorLogin(db, { name: '田中太郎', phoneLast4: '1234', now: after })
    expect(result.ok).toBe(true)
  })

  it('成功すると失敗回数がリセットされる', async () => {
    const id = await insertContractor(db, { name: '田中太郎', phoneLast4: '1234' })
    const now = new Date()
    await attemptContractorLogin(db, { name: '田中太郎', phoneLast4: '0000', now })
    await attemptContractorLogin(db, { name: '田中太郎', phoneLast4: '0000', now })
    await attemptContractorLogin(db, { name: '田中太郎', phoneLast4: '1234', now })

    const row = await db.query.contractors.findFirst({ where: eq(contractors.id, id) })
    expect(row?.failedLoginCount).toBe(0)
    expect(row?.lockedUntil).toBeNull()
  })
})

describe('reissueLoginToken / attemptQrLogin', () => {
  it('発行したトークンでQRログインできる', async () => {
    const id = await insertContractor(db)
    const issued = await reissueLoginToken(db, id, actor, new Date())
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const result = await attemptQrLogin(db, issued.token)
    expect(result).toEqual({ ok: true, contractorId: id, sessionVersion: 2 }) // 再発行でsvが+1される
  })

  it('再発行すると旧トークンは無効になる', async () => {
    const id = await insertContractor(db)
    const first = await reissueLoginToken(db, id, actor, new Date())
    if (!first.ok) throw new Error('setup failed')
    await reissueLoginToken(db, id, actor, new Date())

    const result = await attemptQrLogin(db, first.token)
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })

  it('でたらめなトークンではログインできない', async () => {
    const result = await attemptQrLogin(db, 'not-a-real-token')
    expect(result).toEqual({ ok: false, reason: 'invalid' })
  })
})

describe('invalidateContractorSessions', () => {
  it('session_versionを上げる（既存のCookieセッションを失効させる）', async () => {
    const id = await insertContractor(db)
    const before = await db.query.contractors.findFirst({ where: eq(contractors.id, id) })

    const result = await invalidateContractorSessions(db, id, actor, new Date())
    expect(result).toEqual({ ok: true })

    const after = await db.query.contractors.findFirst({ where: eq(contractors.id, id) })
    expect(after?.sessionVersion).toBe((before?.sessionVersion ?? 0) + 1)
  })
})

describe('unlockContractor', () => {
  it('ロックを解除する', async () => {
    const id = await insertContractor(db, { name: '田中太郎', phoneLast4: '1234' })
    const now = new Date('2026-09-15T00:00:00.000Z')
    for (let i = 0; i < 5; i++) {
      await attemptContractorLogin(db, { name: '田中太郎', phoneLast4: '0000', now })
    }
    await unlockContractor(db, id, actor, now)

    const row = await db.query.contractors.findFirst({ where: eq(contractors.id, id) })
    expect(row?.lockedUntil).toBeNull()
    expect(row?.failedLoginCount).toBe(0)

    const result = await attemptContractorLogin(db, { name: '田中太郎', phoneLast4: '1234', now })
    expect(result.ok).toBe(true)
  })
})

describe('hashLoginToken との整合性', () => {
  it('DBに保存されるのはハッシュだけで、平文トークンは保存されない', async () => {
    const id = await insertContractor(db)
    const issued = await reissueLoginToken(db, id, actor, new Date())
    if (!issued.ok) throw new Error('setup failed')

    const row = await db.query.contractors.findFirst({ where: eq(contractors.id, id) })
    expect(row?.loginTokenHash).toBe(await hashLoginToken(issued.token))
    expect(row?.loginTokenHash).not.toBe(issued.token)
  })
})
