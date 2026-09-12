// Playwright（E2E）はCloudflare Accessを経由せず、DEV_OWNER_EMAILのバイパスで
// オーナー画面を確認する。ローカルでは開発者自身の `.dev.vars` をそのまま使い、
// CI（`.dev.vars` が存在しない）ではE2E専用の非機密なダミー値を書き込む。
// これらの値はテスト実行中しか使わないローカルWorkerのためのものであり、
// 本番のsecretとは無関係（値を知られても実害が無い）。
import { existsSync, writeFileSync } from 'node:fs'

if (!existsSync('.dev.vars')) {
  writeFileSync(
    '.dev.vars',
    [
      'APP_ENV=development',
      'ACCESS_TEAM_DOMAIN=',
      'ACCESS_AUD=',
      'OWNER_EMAILS=e2e-owner@example.com',
      'DEV_OWNER_EMAIL=e2e-owner@example.com',
      'SESSION_SECRET=e2e-test-session-secret-not-for-production-use',
      'STRIPE_SECRET_KEY=sk_test_e2e_dummy',
      'STRIPE_WEBHOOK_SECRET=whsec_test_e2e_dummy',
      '',
    ].join('\n'),
  )
}
