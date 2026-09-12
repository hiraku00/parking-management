import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'
import { type OwnerAuthConfig, verifyOwnerRequest } from './owner'

const TEAM_DOMAIN = 'test-team.cloudflareaccess.com'
const AUD = 'test-audience'
const ISSUER = `https://${TEAM_DOMAIN}`
const OWNER_EMAIL = 'owner@example.com'

const baseConfig: OwnerAuthConfig = {
  APP_ENV: 'production',
  ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
  ACCESS_AUD: AUD,
  OWNER_EMAILS: OWNER_EMAIL,
  DEV_OWNER_EMAIL: '',
}

let privateKey: CryptoKey
let getKey: ReturnType<typeof createLocalJWKSet>

async function sign(claims: {
  email?: string
  aud?: string
  iss?: string
  expiresInSeconds?: number
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return await new SignJWT({ email: claims.email ?? OWNER_EMAIL })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuedAt(now)
    .setExpirationTime(now + (claims.expiresInSeconds ?? 3600))
    .setAudience(claims.aud ?? AUD)
    .setIssuer(claims.iss ?? ISSUER)
    .sign(privateKey)
}

function headersWithAssertion(token: string): Headers {
  return new Headers({ 'cf-access-jwt-assertion': token })
}

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey
  const publicJwk = (await exportJWK(pair.publicKey)) as JWK
  publicJwk.kid = 'test-key'
  publicJwk.alg = 'RS256'
  getKey = createLocalJWKSet({ keys: [publicJwk] })
})

describe('verifyOwnerRequest', () => {
  it('正常: 許可されたメールの有効なJWTならオーナーを返す', async () => {
    const token = await sign({})
    const owner = await verifyOwnerRequest(headersWithAssertion(token), { getKey, config: baseConfig })
    expect(owner).toEqual({ email: OWNER_EMAIL })
  })

  it('aud違い: audience が一致しなければ null', async () => {
    const token = await sign({ aud: 'wrong-audience' })
    const owner = await verifyOwnerRequest(headersWithAssertion(token), { getKey, config: baseConfig })
    expect(owner).toBeNull()
  })

  it('期限切れ: exp が過去なら null', async () => {
    const token = await sign({ expiresInSeconds: -60 })
    const owner = await verifyOwnerRequest(headersWithAssertion(token), { getKey, config: baseConfig })
    expect(owner).toBeNull()
  })

  it('許可されていないメール: 署名は正しくてもOWNER_EMAILSに無ければ null', async () => {
    const token = await sign({ email: 'stranger@example.com' })
    const owner = await verifyOwnerRequest(headersWithAssertion(token), { getKey, config: baseConfig })
    expect(owner).toBeNull()
  })

  it('issuer違い: issuer が一致しなければ null', async () => {
    const token = await sign({ iss: 'https://evil.example.com' })
    const owner = await verifyOwnerRequest(headersWithAssertion(token), { getKey, config: baseConfig })
    expect(owner).toBeNull()
  })

  it('トークンが無ければ null', async () => {
    const owner = await verifyOwnerRequest(new Headers(), { getKey, config: baseConfig })
    expect(owner).toBeNull()
  })

  it('本番でAccessの設定（team domain / aud）が無い場合は、トークンがあってもnull（fail closed）', async () => {
    const token = await sign({})
    const owner = await verifyOwnerRequest(headersWithAssertion(token), {
      getKey,
      config: { ...baseConfig, ACCESS_TEAM_DOMAIN: '', ACCESS_AUD: '' },
    })
    expect(owner).toBeNull()
  })

  it('本番（APP_ENV=production）では DEV_OWNER_EMAIL があってもバイパスしない', async () => {
    const owner = await verifyOwnerRequest(new Headers(), {
      getKey,
      config: { ...baseConfig, DEV_OWNER_EMAIL: 'dev-owner@localhost' },
    })
    expect(owner).toBeNull() // トークンが無いので、バイパスしなければnullになるはず
  })

  it('開発環境（APP_ENV!=production）でDEV_OWNER_EMAILが設定されていれば、トークン無しでバイパスする', async () => {
    const owner = await verifyOwnerRequest(new Headers(), {
      getKey,
      config: { ...baseConfig, APP_ENV: 'development', DEV_OWNER_EMAIL: 'dev-owner@localhost' },
    })
    expect(owner).toEqual({ email: 'dev-owner@localhost' })
  })
})
