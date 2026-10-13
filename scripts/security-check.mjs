#!/usr/bin/env node
/**
 * セキュリティ点検スクリプト（読み取り専用）。
 *
 * IPA「不正アクセスによる漏えい等の事案を踏まえ、速やかに実施すべき対策等について」
 * （2026-10-09）が求める点検項目のうち、このシステムで機械的に確認できるものを
 * まとめて実行する。
 *   https://www.ipa.go.jp/security/security-alert/2026/alert20261009.html
 *
 * 注意喚起の項目 → このスクリプトのセクション
 *   外部公開アプリケーションの精査            → 1. 外部公開アプリ / 2. 設定
 *   アカウントの確認（身に覚えのない・無効化したはずのもの） → 3. アカウント / 7. 外部サービス
 *   ログの確認（失敗の量・時間帯・平時との差）   → 4. ログ・監査記録
 *   保有データの再点検                         → 5. 保有データ
 *   未適用のパッチ                             → 6. 依存関係
 *   認証情報・外部サービス・API連携の管理        → 7. 秘密情報 / 8. 外部サービス
 *   自動化できない項目                         → 9. 手動確認
 *
 * 本番に対して行うのは GET（HTTP）と SELECT（D1）、`wrangler secret list`・
 * `gh api`（GET）だけで、何も書き込まない。DBの結果は件数・ID・操作名だけを出力し、
 * 氏名・電話番号・秘密情報の値は出力しない。
 *
 * 使い方:
 *   node scripts/security-check.mjs [オプション]
 *   npm run security:check -- --db local
 *
 * 終了コード: 0 = FAILなし / 1 = FAILあり（--strict なら WARN も対象）/ 2 = 引数エラー
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_BASE_URL = 'https://parking-management.hiraku00.workers.dev'
const DAY_MS = 86_400_000
const SECTIONS = ['http', 'config', 'db', 'npm', 'git', 'github', 'cloudflare']

const HELP = `使い方: node scripts/security-check.mjs [オプション]

  --base-url <url>        HTTP点検の対象（既定: ${DEFAULT_BASE_URL}）
  --db <remote|local|skip> D1の点検対象（既定: remote。localはローカルD1、skipは点検しない）
  --days <n>              ログを確認する期間の日数（既定: 30）
  --retention-months <n>  アーカイブ済み契約者の個人情報を保持してよい月数の目安（既定: 24）
  --skip <list>           点検しないセクション（カンマ区切り: ${SECTIONS.join(',')}）
  --json                  結果をJSONで出力する
  --strict                WARNも失敗として扱う（終了コード1）
  -h, --help              このヘルプ
`

function parseArgs(argv) {
  const o = {
    baseUrl: DEFAULT_BASE_URL,
    db: 'remote',
    days: 30,
    retentionMonths: 24,
    skip: new Set(),
    json: false,
    strict: false,
  }
  const fail = (msg) => {
    console.error(`${msg}\n\n${HELP}`)
    process.exit(2)
  }
  const posInt = (name, v) => {
    const n = Number(v)
    if (!Number.isInteger(n) || n <= 0) fail(`${name} には正の整数を指定してください: ${v}`)
    return n
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const val = () => {
      if (i + 1 >= argv.length) fail(`${a} には値が必要です`)
      return argv[++i]
    }
    if (a === '-h' || a === '--help') {
      console.log(HELP)
      process.exit(0)
    } else if (a === '--base-url') o.baseUrl = val().replace(/\/+$/, '')
    else if (a === '--db') {
      o.db = val()
      if (!['remote', 'local', 'skip'].includes(o.db))
        fail(`--db は remote / local / skip のいずれかです: ${o.db}`)
    } else if (a === '--days') o.days = posInt('--days', val())
    else if (a === '--retention-months') o.retentionMonths = posInt('--retention-months', val())
    else if (a === '--skip') {
      for (const s of val()
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)) {
        if (!SECTIONS.includes(s)) fail(`--skip に未知のセクションがあります: ${s}`)
        o.skip.add(s)
      }
    } else if (a === '--json') o.json = true
    else if (a === '--strict') o.strict = true
    else fail(`未知のオプションです: ${a}`)
  }
  try {
    new URL(o.baseUrl)
  } catch {
    fail(`--base-url が正しいURLではありません: ${o.baseUrl}`)
  }
  return o
}

const opts = parseArgs(process.argv.slice(2))

// ─── 結果の記録 ─────────────────────────────────────────────
const results = []
let currentSection = ''
const section = (title) => {
  currentSection = title
}
const add = (level, title, detail = '') => results.push({ section: currentSection, level, title, detail })
const pass = (t, d) => add('PASS', t, d)
const warn = (t, d) => add('WARN', t, d)
const fail = (t, d) => add('FAIL', t, d)
const skip = (t, d) => add('SKIP', t, d)

// ─── 共通ヘルパー ───────────────────────────────────────────
function run(cmd, args, extra = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...extra })
}

function readText(rel) {
  const p = join(ROOT, rel)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

/** wrangler.jsonc のようなコメント・末尾カンマ付きJSONを読む。 */
function parseJsonc(text) {
  let out = ''
  let inStr = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      out += c
      if (c === '\\') out += text[++i]
      else if (c === '"') inStr = false
    } else if (c === '"') {
      inStr = true
      out += c
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
    } else if (c === '/' && text[i + 1] === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++
      i++
    } else out += c
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
}

const fmtDate = (ms) => new Date(ms + 9 * 3600_000).toISOString().replace('T', ' ').slice(0, 16) + ' JST'
const jstMonth = (ms) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 7)
const lastLines = (s, n = 3) => (s || '').trim().split('\n').slice(-n).join(' ').slice(0, 300)

const wranglerConfigText = readText('wrangler.jsonc')
let wranglerConfig = null
try {
  wranglerConfig = wranglerConfigText ? parseJsonc(wranglerConfigText) : null
} catch {
  wranglerConfig = null
}
const ownerEmails = String(wranglerConfig?.vars?.OWNER_EMAILS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

// ─── 1. 外部公開アプリケーション（HTTP） ─────────────────────
async function checkHttp() {
  section('1. 外部公開アプリケーション（HTTP・認証なしのGETのみ）')
  const base = new URL(opts.baseUrl)
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
  if (!isLocal && base.protocol !== 'https:') warn('HTTPSではありません', opts.baseUrl)

  const get = async (path) => {
    try {
      return await fetch(new URL(path, base), {
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
        headers: { 'user-agent': 'parking-security-check/1.0' },
      })
    } catch (e) {
      return { error: e?.cause?.code || e?.message || String(e) }
    }
  }

  const home = await get('/')
  if (home.error) {
    warn('対象に接続できません', `${opts.baseUrl}（${home.error}）。HTTP点検を中止しました`)
    return
  }

  // 公開してよい入口
  const health = await get('/api/health')
  if (health.status === 200) {
    const body = (await health.text()).trim()
    body === '{"status":"ok"}'
      ? pass('/api/health は生存確認のみを返す')
      : warn('/api/health が想定外の内容を返しています', body.slice(0, 120))
  } else fail('/api/health が200ではありません', `status=${health.status}`)

  home.status === 200
    ? pass('/（ログイン画面）は200')
    : warn('/ が200ではありません', `status=${home.status}`)

  // 管理画面: 未認証では絶対に見えてはいけない
  const adminPaths = ['/admin', '/admin/contractors', '/admin/payments', '/admin/settings', '/admin/audit']
  if (isLocal) {
    skip(
      '管理画面の未認証アクセス拒否',
      'localhost では DEV_OWNER_EMAIL によりAccessをバイパスするため点検しません',
    )
  } else {
    for (const p of adminPaths) {
      const r = await get(p)
      if (r.error) warn(`${p} に接続できません`, r.error)
      else if (r.status === 200)
        fail(`${p} が未認証で表示されます`, 'Cloudflare Access / proxy.ts の保護が効いていません')
      else if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get('location') || ''
        if (loc.includes('cloudflareaccess.com'))
          pass(`${p} は未認証だとAccessのログインへ`, `status=${r.status}`)
        else
          warn(
            `${p} のリダイレクト先がAccessではありません`,
            `status=${r.status} location=${loc.slice(0, 100)}`,
          )
      } else if (r.status === 401 || r.status === 403) pass(`${p} は未認証だと拒否`, `status=${r.status}`)
      else warn(`${p} が想定外のステータスです`, `status=${r.status}`)
    }
  }

  // 契約者ポータル: Cookieなしでは見えてはいけない
  for (const p of ['/portal', '/portal/history', '/portal/pay']) {
    const r = await get(p)
    if (r.error) warn(`${p} に接続できません`, r.error)
    else if (r.status === 200) fail(`${p} がログインなしで表示されます`)
    else if ((r.status >= 300 && r.status < 400) || r.status === 401 || r.status === 403)
      pass(`${p} はログインなしだと拒否`, `status=${r.status}`)
    else warn(`${p} が想定外のステータスです`, `status=${r.status}`)
  }

  // Webhook: GETは受け付けない（署名検証はPOST側）
  const wh = await get('/api/webhooks/stripe')
  wh.status === 405
    ? pass('/api/webhooks/stripe のGETは405')
    : wh.status === 200
      ? fail('/api/webhooks/stripe のGETが200です')
      : warn('/api/webhooks/stripe が想定外のステータスです', `status=${wh.status}`)

  // 置いてはいけないファイルが公開されていないか
  const leaks = [
    '/.env',
    '/.dev.vars',
    '/.git/config',
    '/wrangler.jsonc',
    '/package.json',
    '/db/seed.dev.sql',
    '/migrations/0000_init.sql',
    '/docs/design/05-auth-security.md',
    '/__debug',
  ]
  const exposed = []
  for (const p of leaks) {
    const r = await get(p)
    if (r.status === 200) exposed.push(p)
  }
  exposed.length === 0
    ? pass('機密・内部ファイルは公開されていない', `${leaks.length}件のパスを確認`)
    : fail('公開されてはいけないパスが200で返ります', exposed.join(', '))

  // セキュリティヘッダー（proxy.ts が付与する想定のもの）
  const h = (n) => home.headers.get(n) || ''
  const headerChecks = [
    ['Strict-Transport-Security', /max-age=\d{7,}/, 'HSTS'],
    ['X-Content-Type-Options', /nosniff/i, 'X-Content-Type-Options'],
    ['X-Frame-Options', /deny|sameorigin/i, 'X-Frame-Options'],
    ['Content-Security-Policy', /frame-ancestors/, 'CSP（frame-ancestors）'],
    ['Referrer-Policy', /.+/, 'Referrer-Policy'],
    ['Cache-Control', /no-store/, 'Cache-Control: no-store（個人情報を含む画面のため）'],
  ]
  for (const [name, re, label] of headerChecks) {
    re.test(h(name))
      ? pass(`ヘッダー: ${label}`)
      : warn(`ヘッダーが不足・不正: ${label}`, `${name}: ${h(name) || '（なし）'}`)
  }
  h('x-powered-by')
    ? warn('X-Powered-By ヘッダーが出ています', h('x-powered-by'))
    : pass('X-Powered-By ヘッダーは出ていない')
}

// ─── 2. 設定（wrangler.jsonc） ──────────────────────────────
function checkConfig() {
  section('2. 設定（wrangler.jsonc）')
  if (!wranglerConfig) {
    skip('wrangler.jsonc を読めませんでした')
    return
  }
  const v = wranglerConfig.vars ?? {}
  v.DEV_OWNER_EMAIL === ''
    ? pass('DEV_OWNER_EMAIL は空（本番でAccessをバイパスしない）')
    : fail('DEV_OWNER_EMAIL が空ではありません', 'Accessのバイパスが本番で有効になる恐れがあります')
  v.APP_ENV === 'production'
    ? pass('APP_ENV=production')
    : warn('APP_ENV が production ではありません', String(v.APP_ENV))
  wranglerConfig.preview_urls === false
    ? pass('preview_urls は無効（Accessが効かないURLを作らない）')
    : warn('preview_urls が無効になっていません', 'Version Preview URL には Access が効きません')
  v.ACCESS_TEAM_DOMAIN && v.ACCESS_AUD
    ? pass('Access の検証設定（ACCESS_TEAM_DOMAIN / ACCESS_AUD）がある')
    : fail('Access の検証設定が不足しています')
  ownerEmails.length > 0
    ? pass(`OWNER_EMAILS: ${ownerEmails.length}件`, ownerEmails.join(', '))
    : fail('OWNER_EMAILS が空です')
  if (ownerEmails.length > 3) warn('オーナー（管理者）が多めです', '必要最小限か確認してください')
  const hasLimiter = (wranglerConfig.ratelimits ?? []).some((r) => r.name === 'LOGIN_LIMITER')
  hasLimiter
    ? pass('ログインのレート制限（LOGIN_LIMITER）が設定されている')
    : warn('LOGIN_LIMITER が見つかりません')
  wranglerConfig.observability?.enabled
    ? pass('Workers Logs（observability）が有効')
    : warn('observability が無効', '不審なアクセスの調査に必要なログが残りません')
}

// ─── D1（読み取り専用） ─────────────────────────────────────
const WRANGLER = join(ROOT, 'node_modules', '.bin', 'wrangler')
function d1(sql) {
  if (!/^\s*select\s/i.test(sql) || sql.includes(';')) throw new Error('SELECT 以外は実行しません')
  const r = run(WRANGLER, [
    'd1',
    'execute',
    'parking',
    opts.db === 'local' ? '--local' : '--remote',
    '--json',
    '--command',
    sql,
  ])
  if (r.error) throw r.error
  if (r.status !== 0)
    throw new Error(lastLines(r.stderr || r.stdout, 4) || `wrangler が終了コード${r.status}で失敗`)
  const out = r.stdout
  const start = out.indexOf('[')
  const parsed = JSON.parse(start >= 0 ? out.slice(start) : out)
  return parsed[0]?.results ?? []
}
const one = (sql) => d1(sql)[0] ?? {}

function checkDb() {
  const target = opts.db === 'local' ? 'ローカルD1' : '本番D1'
  const now = Date.now()
  const since = now - opts.days * DAY_MS

  section(`3. アカウントの棚卸し（${target}）`)
  if (!existsSync(WRANGLER)) {
    skip('wrangler が見つかりません', '`npm ci` を実行してください')
    return
  }
  try {
    const total = one(`SELECT COUNT(*) AS n, SUM(archived_at IS NULL) AS active FROM contractors`)
    pass(`契約者: 在籍${total.active ?? 0}名 / 全${total.n ?? 0}名`)

    const archivedTok = one(
      `SELECT COUNT(*) AS n FROM contractors WHERE archived_at IS NOT NULL AND login_token_hash IS NOT NULL`,
    ).n
    archivedTok > 0
      ? warn(
          `アーカイブ済みなのにQRトークンが残っている契約者: ${archivedTok}名`,
          'ログイン自体は拒否されますが、不要な認証情報は消すのが望ましいです',
        )
      : pass('アーカイブ済みの契約者にQRトークンは残っていない')

    const ended = one(
      `SELECT COUNT(*) AS n FROM contractors WHERE archived_at IS NULL AND contract_end_month IS NOT NULL AND contract_end_month < '${jstMonth(now)}'`,
    ).n
    ended > 0
      ? warn(
          `契約終了月を過ぎているのにアーカイブされていない契約者: ${ended}名`,
          '無効化したはずのアカウントがログインできる状態です。アーカイブしてください',
        )
      : pass('契約終了後も在籍扱いの契約者はいない')

    const stale = one(
      `SELECT COUNT(*) AS n FROM contractors WHERE archived_at IS NULL AND login_token_hash IS NOT NULL AND login_token_issued_at < ${now - 365 * DAY_MS}`,
    ).n
    stale > 0
      ? warn(`1年以上前に発行したQRがそのまま有効: ${stale}名`, '紛失・流出に備え、再発行を検討してください')
      : pass('1年以上前に発行したままのQRトークンはない')

    const lock = one(
      `SELECT COUNT(*) AS n, COALESCE(MAX(failed_login_count),0) AS max_failed, COALESCE(SUM(locked_until > ${now}),0) AS locked FROM contractors WHERE failed_login_count > 0 OR locked_until > ${now}`,
    )
    lock.locked > 0
      ? warn(
          `現在ロック中の契約者: ${lock.locked}名`,
          `ログイン失敗が続いています（最大${lock.max_failed}回）。総当たりの可能性を確認してください`,
        )
      : lock.n > 0
        ? pass(`ログイン失敗の記録がある契約者: ${lock.n}名（ロック中なし）`, `最大${lock.max_failed}回`)
        : pass('ログイン失敗の記録はない')
  } catch (e) {
    skip(`${target}に接続できず、アカウント・ログ・データの点検を中止しました`, e.message)
    return
  }

  section(`4. ログ・監査記録（${target}・直近${opts.days}日）`)
  try {
    const ninety = now - 90 * DAY_MS
    const actors = d1(
      `SELECT actor, COUNT(*) AS n, MAX(created_at) AS last FROM audit_logs WHERE created_at >= ${ninety} GROUP BY actor`,
    )
    const unexpected = actors.filter(
      (a) => a.actor.startsWith('owner:') && !ownerEmails.includes(a.actor.slice(6).toLowerCase()),
    )
    const odd = actors.filter((a) => !/^(owner:|contractor:|stripe$|system$)/.test(a.actor))
    if (unexpected.length > 0) {
      const detail = unexpected.map((a) => `${a.actor}（${a.n}件・最終${fmtDate(a.last)}）`).join(' / ')
      const msg = 'OWNER_EMAILS に無いオーナーとして記録された操作があります（直近90日）'
      opts.db === 'local' ? warn(msg, `${detail}（ローカルの開発用アカウントなら想定内）`) : fail(msg, detail)
    } else pass('直近90日の操作者はすべて OWNER_EMAILS に含まれる', `${actors.length}種類の操作者`)
    if (odd.length > 0) warn('想定外の形式の操作者があります', odd.map((a) => a.actor).join(', '))

    const win = one(
      `SELECT COALESCE(SUM(created_at >= ${since}),0) AS recent, COALESCE(SUM(created_at < ${since}),0) AS base FROM audit_logs WHERE created_at >= ${now - 4 * opts.days * DAY_MS}`,
    )
    const baseDays = 3 * opts.days
    const recentRate = win.recent / opts.days
    const baseRate = win.base / baseDays
    if (win.base === 0) {
      pass(
        '操作件数の比較対象になる過去の記録がまだありません',
        `直近${opts.days}日: ${win.recent}件（運用が長くなると平時との比較ができます）`,
      )
    } else if (win.recent >= 10 && recentRate > 3 * Math.max(baseRate, 0.1)) {
      warn(
        '直近の操作件数が平時より大きく増えています',
        `直近${opts.days}日: ${win.recent}件（${recentRate.toFixed(1)}件/日）/ それ以前${baseDays}日: ${win.base}件（${baseRate.toFixed(1)}件/日）`,
      )
    } else {
      pass(
        '操作件数は平時と同程度',
        `直近${opts.days}日: ${win.recent}件 / それ以前${baseDays}日: ${win.base}件`,
      )
    }

    const sensitive = d1(
      `SELECT created_at, actor, action, entity_id FROM audit_logs WHERE created_at >= ${since} AND action IN ('settings.update','payment.amount_mismatch','payment.refund','contractor.reissue_login_token','contractor.invalidate_sessions','contractor.unlock','contractor.archive') ORDER BY created_at DESC LIMIT 200`,
    )
    const by = (a) => sensitive.filter((r) => r.action === a)
    const lines = (rows) =>
      rows
        .slice(0, 10)
        .map((r) => `${fmtDate(r.created_at)} ${r.actor} → ${r.entity_id.slice(0, 8)}`)
        .join(' / ')
    by('settings.update').length > 0
      ? warn(
          `設定の変更: ${by('settings.update').length}件`,
          `振込先口座・事業者情報などに身に覚えのない変更がないか確認: ${lines(by('settings.update'))}`,
        )
      : pass('設定（振込先口座など）の変更はない')
    by('payment.amount_mismatch').length > 0
      ? warn(
          `Stripeの金額不一致: ${by('payment.amount_mismatch').length}件`,
          `不正な決済の試行の可能性があります: ${lines(by('payment.amount_mismatch'))}`,
        )
      : pass('Stripeの金額不一致はない')
    by('payment.refund').length > 0
      ? warn(
          `返金: ${by('payment.refund').length}件`,
          `心当たりのない返金がないか確認: ${lines(by('payment.refund'))}`,
        )
      : pass('返金はない')
    const authOps = [
      'contractor.reissue_login_token',
      'contractor.invalidate_sessions',
      'contractor.unlock',
      'contractor.archive',
    ]
    const authCount = authOps.reduce((s, a) => s + by(a).length, 0)
    authCount > 0
      ? pass(
          `契約者の認証まわりの操作: ${authCount}件（QR再発行・セッション無効化・ロック解除・アーカイブ）`,
          lines(sensitive.filter((r) => authOps.includes(r.action))),
        )
      : pass('契約者の認証まわりの操作はない')

    const ownerRows = d1(
      `SELECT created_at, actor FROM audit_logs WHERE created_at >= ${since} AND actor LIKE 'owner:%' LIMIT 1000`,
    )
    const night = ownerRows.filter((r) => {
      const hour = new Date(r.created_at + 9 * 3600_000).getUTCHours()
      return hour >= 0 && hour < 5
    })
    night.length > 0
      ? warn(
          `深夜（JST 0〜5時）のオーナー操作: ${night.length}件`,
          `普段の利用時間帯と比べてください。最新: ${fmtDate(night[0].created_at)}`,
        )
      : pass('深夜（JST 0〜5時）のオーナー操作はない')

    const cardFail = one(
      `SELECT COUNT(*) AS n FROM payments WHERE method='card' AND status IN ('failed','canceled') AND created_at >= ${now - 7 * DAY_MS}`,
    ).n
    cardFail >= 10
      ? warn(
          `直近7日のカード決済の失敗・中止: ${cardFail}件`,
          'カードの不正試行（カードテスティング）の可能性があります。Stripeでも確認してください',
        )
      : pass(`直近7日のカード決済の失敗・中止: ${cardFail}件`)

    warn(
      '検知のギャップ: 契約者のログイン失敗・ログイン元IPが監査ログに残らない',
      'D1に残るのは契約者ごとの失敗回数とロック状態のみです。IPや時間帯の比較は Workers Logs と Cloudflare のレート制限で確認してください',
    )
  } catch (e) {
    skip('ログ・監査記録の点検を中止しました', e.message)
  }

  section(`5. 保有データ（${target}）`)
  try {
    const months = opts.retentionMonths
    const old = one(
      `SELECT COUNT(*) AS n FROM contractors WHERE archived_at IS NOT NULL AND archived_at < ${now - Math.round(months * 30.44 * DAY_MS)}`,
    ).n
    old > 0
      ? warn(
          `アーカイブから${months}か月以上たった契約者の個人情報（氏名・電話番号など）が残っている: ${old}名`,
          '不要な情報は持たない方針に沿って、削除・匿名化の要否を判断してください（入金・領収書の記録は会計上の保存義務に注意）',
        )
      : pass(`アーカイブから${months}か月以上たった契約者の個人情報は残っていない`)
  } catch (e) {
    skip('保有データの点検を中止しました', e.message)
  }
  checkSchemaData()
}

function checkSchemaData() {
  const schema = readText('lib/db/schema.ts')
  if (!schema) {
    skip('lib/db/schema.ts を読めませんでした')
    return
  }
  const cols = [...schema.matchAll(/(?:text|integer)\('([a-z0-9_]+)'/g)].map((m) => m[1])
  const pii = [...new Set(cols.filter((c) => /name|kana|phone|email|address|note|payer|bank_/.test(c)))]
  pass(`個人情報・金融情報を含む列: ${pii.length}列`, pii.join(', '))
  const cardLike = cols.filter((c) => /card_?(number|no)|cvc|cvv|^pan$|security_code/.test(c))
  cardLike.length === 0
    ? pass('カード番号・セキュリティコードを保存する列はない（決済はStripeに委託）')
    : fail('カード情報を保存する可能性のある列があります', cardLike.join(', '))
}

// ─── 6. 依存関係（未適用パッチ） ────────────────────────────
function checkNpm() {
  section('6. 依存関係の既知の脆弱性（npm audit）')
  const audit = (extra) => {
    const r = run('npm', ['audit', '--json', ...extra])
    if (r.error) return { error: r.error.message }
    try {
      const j = JSON.parse(r.stdout)
      if (j.error) return { error: j.error.summary || j.error.code || 'npm audit のエラー' }
      return { vulns: j.vulnerabilities ?? {} }
    } catch {
      return { error: lastLines(r.stderr || r.stdout) || 'npm audit の出力を解析できません' }
    }
  }

  // npm audit は「脆弱なパッケージに依存しているだけ」のパッケージも脆弱として数える。
  // 実際のアドバイザリ（via がオブジェクトのもの）だけを数え、どの直接依存を経由して
  // 入っているかを添える。
  // 脆弱でない中間パッケージ（例: postcss）を挟むと effects を辿れないため、`npm ls` で
  // どの直接依存の配下にあるかを引く。
  const lsParents = (pkg, extra) => {
    const r = run('npm', ['ls', pkg, '--all', '--json', ...extra])
    try {
      const tree = JSON.parse(r.stdout).dependencies ?? {}
      const has = (node) => Object.entries(node.dependencies ?? {}).some(([n, c]) => n === pkg || has(c))
      return Object.entries(tree)
        .filter(([n, c]) => n === pkg || has(c))
        .map(([n]) => n)
    } catch {
      return []
    }
  }
  const advisories = (res, extra) => {
    const direct = (name, seen = new Set()) => {
      if (seen.has(name)) return []
      seen.add(name)
      const v = res.vulns[name]
      if (!v) return []
      return [...(v.isDirect ? [name] : []), ...(v.effects ?? []).flatMap((e) => direct(e, seen))]
    }
    const found = new Map()
    for (const [name, v] of Object.entries(res.vulns)) {
      for (const via of v.via) {
        if (typeof via === 'string' || found.has(via.url)) continue
        let through = [...new Set(direct(name))]
        if (through.length === 0 && !v.isDirect) through = lsParents(name, extra)
        found.set(via.url, {
          pkg: name,
          severity: via.severity,
          title: via.title,
          id: String(via.url).split('/').pop(),
          through,
          isDirect: Boolean(v.isDirect),
        })
      }
    }
    return [...found.values()]
  }
  const describe = (list) =>
    list
      .map(
        (a) =>
          `${a.pkg}（${a.id}: ${a.title}・経由: ${a.through.join(', ') || (a.isDirect ? '直接' : '不明')}）`,
      )
      .join(' / ')

  const prod = audit(['--omit=dev'])
  if (prod.error) {
    skip('npm audit を実行できませんでした', prod.error)
    return
  }
  const prodAdv = advisories(prod, ['--omit=dev'])
  const prodCritical = prodAdv.filter((a) => a.severity === 'critical')
  const prodHigh = prodAdv.filter((a) => a.severity === 'high')
  const prodMod = prodAdv.filter((a) => a.severity === 'moderate')
  const buildNote =
    'vinext のビルド時ツール（Vite プラグイン等）経由のものは本番Workerでは実行されない可能性が高いですが、更新で解消できるか確認してください。npmが示す修正が依存のダウングレードの場合は適用しないでください'
  if (prodCritical.length > 0)
    fail(`本番依存に critical の脆弱性: ${prodCritical.length}件`, describe(prodCritical))
  if (prodHigh.length > 0)
    warn(
      `本番依存（dependencies）に high の脆弱性: ${prodHigh.length}件`,
      `${describe(prodHigh)}。${buildNote}`,
    )
  if (prodMod.length > 0)
    warn(`本番依存（dependencies）に moderate の脆弱性: ${prodMod.length}件`, describe(prodMod))
  if (prodAdv.length === 0) pass('本番依存に既知の脆弱性はない')

  const all = audit([])
  if (!all.error) {
    const prodUrls = new Set(prodAdv.map((a) => `${a.pkg}:${a.id}`))
    const devOnly = advisories(all, []).filter(
      (a) => (a.severity === 'high' || a.severity === 'critical') && !prodUrls.has(`${a.pkg}:${a.id}`),
    )
    devOnly.length > 0
      ? warn(
          `開発依存（ビルド・テスト・デプロイ用ツール）にだけ high/critical の脆弱性: ${devOnly.length}件`,
          describe(devOnly),
        )
      : pass('開発依存にだけある high/critical の脆弱性はない')
  }
  const tracked = run('git', ['ls-files', 'package-lock.json']).stdout.trim()
  tracked
    ? pass('package-lock.json がコミットされている（依存を固定）')
    : warn('package-lock.json がコミットされていません')
}

// ─── 7. 秘密情報の混入・管理（git・ローカル） ─────────────────
function checkGit() {
  section('7. 秘密情報の混入・管理（このリポジトリは公開）')
  const ls = run('git', ['ls-files', '-z'])
  if (ls.status !== 0) {
    skip('git ls-files に失敗しました', lastLines(ls.stderr))
    return
  }
  const files = ls.stdout.split('\0').filter(Boolean)
  const bad = files.filter(
    (f) =>
      /(^|\/)\.dev\.vars(\.|$)|(^|\/)\.env(\.|$)|\.pem$|\.p12$|id_rsa|id_ed25519/.test(f) &&
      !/example|sample/.test(f),
  )
  bad.length === 0
    ? pass('秘密情報のファイルはコミットされていない')
    : fail('秘密情報のファイルがコミットされています', bad.join(', '))

  const patterns = [
    ['Stripe 本番キー', '(sk|rk)_live_[0-9A-Za-z]{10,}'],
    ['Stripe Webhook署名シークレット', 'whsec_[0-9A-Za-z]{24,}'],
    ['秘密鍵', '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'],
    ['AWSアクセスキー', 'AKIA[0-9A-Z]{16}'],
    ['GitHubトークン', 'gh[pousr]_[0-9A-Za-z]{30,}'],
  ]
  const hits = []
  for (const [label, re] of patterns) {
    const r = run('git', ['grep', '-n', '-I', '-o', '-E', re, 'HEAD', '--'])
    for (const line of r.stdout.split('\n').filter(Boolean)) {
      const m = line.match(/^HEAD:(.+?):(\d+):(.*)$/)
      if (!m || /x{4,}|\.{3}|example|placeholder/i.test(m[3])) continue
      hits.push(`${label}（${m[1]}:${m[2]}）`)
    }
  }
  hits.length === 0
    ? pass('現在のコードに秘密情報らしき文字列はない')
    : fail('秘密情報らしき文字列がコードにあります（値は表示しません）', hits.join(', '))

  const hist = run('git', [
    'log',
    '--all',
    '--oneline',
    '-G',
    '(sk|rk)_live_[0-9A-Za-z]{10,}|-----BEGIN ([A-Z]+ )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}',
  ])
  const commits = hist.stdout.split('\n').filter(Boolean)
  commits.length === 0
    ? pass('git履歴にも本番キー・秘密鍵らしきものはない')
    : fail(
        `git履歴に秘密情報らしきものを含むコミットがあります: ${commits.length}件`,
        `${commits
          .slice(0, 5)
          .map((c) => c.slice(0, 7))
          .join(', ')}。該当キーは失効・再発行してください`,
      )

  const devVars = join(ROOT, '.dev.vars')
  if (existsSync(devVars)) {
    const mode = statSync(devVars).mode & 0o077
    mode === 0
      ? pass('.dev.vars は所有者のみ読み書き可')
      : warn('.dev.vars が他のユーザーから読めます', 'chmod 600 .dev.vars')
    const key = (readFileSync(devVars, 'utf8').match(/^STRIPE_SECRET_KEY=(.*)$/m)?.[1] ?? '').trim()
    if (/^(sk|rk)_live_/.test(key))
      warn(
        'ローカルの .dev.vars に本番のStripeキーがあります',
        'ローカルではテストキー（sk_test_）を使ってください',
      )
    else if (key) pass('ローカルのStripeキーはテストキー')
  } else skip('.dev.vars はありません（ローカル開発用）')
}

// ─── 8. 外部サービス・API連携の棚卸し ────────────────────────
function checkWorkflows() {
  const dir = join(ROOT, '.github', 'workflows')
  if (!existsSync(dir)) return { used: new Set(), environments: new Set() }
  const used = new Set()
  const environments = new Set()
  const thirdParty = []
  const noPerm = []
  for (const f of readdirSync(dir).filter((x) => /\.ya?ml$/.test(x))) {
    const text = readFileSync(join(dir, f), 'utf8')
    for (const m of text.matchAll(/secrets\.([A-Z0-9_]+)/g)) used.add(m[1])
    for (const m of text.matchAll(/^\s+environment:\s*([\w-]+)\s*$/gm)) environments.add(m[1])
    for (const m of text.matchAll(/uses:\s*([^\s@]+)@(\S+)/g)) {
      if (!/^actions\//.test(m[1]) && !/^[0-9a-f]{40}$/.test(m[2])) thirdParty.push(`${m[1]}@${m[2]}（${f}）`)
    }
    if (!/^permissions:/m.test(text)) noPerm.push(f)
  }
  thirdParty.length === 0
    ? pass('GitHub Actions は公式（actions/*）のみ、または全コミットSHAで固定')
    : warn(
        'サードパーティのActionがタグ指定のままです',
        `${thirdParty.join(', ')}（コミットSHAで固定してください）`,
      )
  noPerm.length === 0
    ? pass('すべてのワークフローで permissions を明示している')
    : warn('permissions が未指定のワークフローがあります', noPerm.join(', '))
  return { used, environments }
}

function checkGithub() {
  section('8. 外部サービス・API連携の棚卸し（GitHub・Cloudflare・Stripe）')
  const { used, environments } = checkWorkflows()

  const repo = run('gh', ['repo', 'view', '--json', 'nameWithOwner,visibility'])
  if (repo.error || repo.status !== 0) {
    skip(
      'GitHub（gh）に接続できず、メンバー・鍵・Webhook・Secretsの棚卸しを省略しました',
      'gh auth login 済みか確認してください',
    )
    return
  }
  const { nameWithOwner } = JSON.parse(repo.stdout)
  const api = (path) => {
    const r = run('gh', ['api', path])
    if (r.status !== 0) return { error: lastLines(r.stderr) }
    try {
      return { data: JSON.parse(r.stdout) }
    } catch {
      return { error: '応答を解析できません' }
    }
  }

  const collabs = api(`repos/${nameWithOwner}/collaborators?per_page=100`)
  if (collabs.error) skip('GitHubのコラボレーターを取得できません', collabs.error)
  else {
    const list = collabs.data.map(
      (c) => `${c.login}（${c.role_name ?? (c.permissions?.admin ? 'admin' : 'write')}）`,
    )
    collabs.data.length <= 1
      ? pass(`GitHubのコラボレーター: ${list.join(', ')}`)
      : warn(
          `GitHubのコラボレーター: ${collabs.data.length}名`,
          `${list.join(', ')}。全員が必要か確認してください`,
        )
  }

  const keys = api(`repos/${nameWithOwner}/keys`)
  if (keys.error) skip('デプロイキーを取得できません', keys.error)
  else
    keys.data.length === 0
      ? pass('デプロイキーはない')
      : warn(
          `デプロイキー: ${keys.data.length}件`,
          keys.data.map((k) => `${k.title}${k.read_only ? '（読取のみ）' : '（書込可）'}`).join(', '),
        )

  const hooks = api(`repos/${nameWithOwner}/hooks`)
  if (hooks.error) skip('リポジトリのWebhookを取得できません', hooks.error)
  else
    hooks.data.length === 0
      ? pass('リポジトリのWebhookはない')
      : warn(
          `リポジトリのWebhook: ${hooks.data.length}件`,
          hooks.data
            .map((h) => {
              try {
                return new URL(h.config?.url ?? '').host
              } catch {
                return '(不明)'
              }
            })
            .join(', '),
        )

  const secretScopes = [['リポジトリ', `repos/${nameWithOwner}/actions/secrets`]]
  for (const env of environments) {
    secretScopes.push([`環境 ${env}`, `repos/${nameWithOwner}/environments/${env}/secrets`])
  }
  const names = []
  const scopeLabels = []
  let secretsError = ''
  for (const [label, path] of secretScopes) {
    const res = api(path)
    if (res.error) secretsError = res.error
    else {
      const n = (res.data.secrets ?? []).map((x) => x.name)
      names.push(...n)
      if (n.length > 0) scopeLabels.push(`${label}: ${n.join(', ')}`)
    }
  }
  if (secretsError && names.length === 0) skip('Actions Secrets の一覧を取得できません', secretsError)
  else {
    const unused = names.filter((n) => !used.has(n))
    const missing = [...used].filter((n) => n !== 'GITHUB_TOKEN' && !names.includes(n))
    if (names.length > 0) pass('Actions Secrets', scopeLabels.join(' / '))
    if (unused.length > 0)
      warn(
        'どのワークフローからも使われていない Actions Secret があります',
        `${unused.join(', ')}（不要なら削除）`,
      )
    else if (names.length > 0) pass('Actions Secrets はすべてワークフローで使われている')
    if (missing.length > 0)
      warn(
        'ワークフローが参照しているが未登録の Secret があります',
        `${missing.join(', ')}（自動デプロイが動かない状態。手動デプロイ運用なら想定内）`,
      )
  }

  const analysis = api(`repos/${nameWithOwner}`)
  if (!analysis.error) {
    const sa = analysis.data.security_and_analysis
    sa?.secret_scanning?.status === 'enabled'
      ? pass('GitHub Secret scanning が有効')
      : warn(
          'GitHub Secret scanning が有効になっていません',
          '公開リポジトリでは無料で使えます。Settings → Code security で有効化してください',
        )
    sa?.secret_scanning_push_protection?.status === 'enabled'
      ? pass('GitHub Push protection が有効')
      : warn('GitHub Push protection が有効になっていません', 'シークレットのpushを事前にブロックできます')
  }
}

function checkCloudflare() {
  section('8b. Cloudflare Workers の Secrets（本番）')
  if (opts.db !== 'remote') {
    skip('本番のSecretsは --db remote のときだけ確認します')
    return
  }
  if (!existsSync(WRANGLER)) {
    skip('wrangler が見つかりません')
    return
  }
  const r = run(WRANGLER, ['secret', 'list', '--format', 'json'])
  if (r.error || r.status !== 0) {
    skip('wrangler secret list に失敗しました', lastLines(r.stderr || r.stdout, 3))
    return
  }
  let names = []
  try {
    const out = r.stdout
    names = JSON.parse(out.slice(out.indexOf('['))).map((s) => s.name)
  } catch {
    skip('Secrets 一覧を解析できません')
    return
  }
  const expected = ['SESSION_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
  const missing = expected.filter((n) => !names.includes(n))
  const extra = names.filter((n) => !expected.includes(n))
  missing.length === 0
    ? pass('必要なSecretsがそろっている', expected.join(', '))
    : fail('必要なSecretsが登録されていません', missing.join(', '))
  extra.length > 0
    ? warn('想定外のSecretsがあります', `${extra.join(', ')}（用途が分からなければ削除）`)
    : pass('想定外のSecretsはない')
}

// ─── 9. 手動確認（自動化できない項目） ───────────────────────
const MANUAL = [
  [
    'Cloudflare Zero Trust',
    'Access のポリシー（許可メール・セッション期間・MFA）と、Access のログ（Zero Trust → Logs → Access）の直近1か月→3か月に、身に覚えのないログイン・失敗の急増がないか',
  ],
  [
    'Cloudflare アカウント',
    'メンバー・APIトークン（特に最終使用日時と権限範囲）の棚卸しと、全員の二要素認証。不要なトークンは削除',
  ],
  [
    'Workers Logs',
    'Workers → parking-management → Logs で、5xx・403・429（レート制限）の増加、普段と違う国・時間帯のアクセスがないか',
  ],
  [
    'Stripe',
    'APIキー（制限付きキーか・最終使用）、Webhookエンドポイント、チームメンバー、不審な決済・返金・ディスピュート、二要素認証',
  ],
  ['GitHub', 'アカウントの二要素認証、Personal access token / SSHキー / 連携アプリの棚卸し'],
  [
    'メール（オーナーのアドレス）',
    'Access のワンタイムPINが届く受信箱の二要素認証・転送設定。ここを奪われると管理画面に入られる',
  ],
  [
    '情報収集',
    'IPA・JPCERT/CC・関係省庁から、不審IPアドレスや侵害痕跡（IoC）が公表されたら、Workers Logs / Access ログと突き合わせる',
  ],
]

// ─── 実行・出力 ─────────────────────────────────────────────
async function main() {
  if (!opts.skip.has('http')) await checkHttp()
  if (!opts.skip.has('config')) checkConfig()
  if (!opts.skip.has('db') && opts.db !== 'skip') checkDb()
  if (!opts.skip.has('npm')) checkNpm()
  if (!opts.skip.has('git')) checkGit()
  if (!opts.skip.has('github')) checkGithub()
  if (!opts.skip.has('cloudflare')) checkCloudflare()

  const count = (lv) => results.filter((r) => r.level === lv).length
  const summary = { pass: count('PASS'), warn: count('WARN'), fail: count('FAIL'), skip: count('SKIP') }
  const exitCode = summary.fail > 0 || (opts.strict && summary.warn > 0) ? 1 : 0

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          source: 'https://www.ipa.go.jp/security/security-alert/2026/alert20261009.html',
          checkedAt: new Date().toISOString(),
          baseUrl: opts.baseUrl,
          db: opts.db,
          summary,
          results,
          manual: MANUAL.map(([target, what]) => ({ target, what })),
        },
        null,
        2,
      ),
    )
    process.exit(exitCode)
  }

  const ICON = { PASS: '✅', WARN: '⚠️ ', FAIL: '❌', SKIP: '➖' }
  console.log('セキュリティ点検（IPA 2026-10-09 注意喚起ベース）')
  console.log(
    `対象: ${opts.baseUrl} / D1: ${opts.db} / ログ期間: 直近${opts.days}日 / ${new Date().toISOString()}`,
  )
  let last = ''
  for (const r of results) {
    if (r.section !== last) {
      console.log(`\n■ ${r.section}`)
      last = r.section
    }
    console.log(`  ${ICON[r.level]} ${r.title}`)
    if (r.detail) console.log(`       ${r.detail}`)
  }
  console.log('\n■ 9. 手動確認（自動では確認できない項目）')
  for (const [target, what] of MANUAL) console.log(`  📝 ${target}: ${what}`)
  console.log(
    `\n結果: ✅ ${summary.pass}  ⚠️  ${summary.warn}  ❌ ${summary.fail}  ➖ ${summary.skip}` +
      (summary.fail > 0 ? '  → FAILの項目を優先して対応してください' : ''),
  )
  if (summary.skip > 0) console.log('➖ は確認できなかった項目です。認証・接続を整えて再実行してください。')
  process.exit(exitCode)
}

main().catch((e) => {
  console.error('点検中に予期しないエラーが発生しました:', e)
  process.exit(1)
})
