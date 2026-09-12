# 8. 実装計画

旧コードは参考として残し、**新しい骨組みの上に作り直します**。旧コードから移すのは、UI部品と、画面の文言・見た目だけです。

## 8.1 フェーズ一覧

| Phase | 内容                                                                | 目安  | 完了条件（DoD）                                                                               |
| ----- | ------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------- |
| 0     | リポジトリの初期化と骨組み                                          | 0.5日 | `npm run dev` で空のページが表示される。CI（lint / typecheck / test / build）が緑             |
| 1     | ドメインロジックとDB                                                | 1日   | `lib/domain` の単体テスト、スキーマ、migration、`syncInvoices` と `allocate` の統合テストが緑 |
| 2     | 管理画面（契約者・設定・請求）                                      | 1.5日 | Access（開発時はバイパス）で、契約者のCRUD、請求の自動生成、免除、設定が動く                  |
| 3     | 契約者の認証とポータル（閲覧）                                      | 1日   | QRログインと予備ログイン、ホーム表示、ロックとレート制限                                      |
| 4     | 入金（振込・現金・カード）と領収書                                  | 2日   | 3種類の入金フローが、端から端まで動く。Webhookの再送でも二重計上されない。領収書が発行される  |
| 5     | 仕上げ（監査ログ画面、ヘッダー、E2E、アクセシビリティ、法定ページ） | 1日   | E2Eが全て緑。Lighthouse のアクセシビリティ 95 以上                                            |
| 6     | 本番構築とリリース                                                  | 0.5日 | 本番URLで、テストモードの全フローを確認 → 本番キーに切り替えて公開                            |

合計で約7.5日（1日＝集中して作業した場合）。

---

## Phase 0 — リポジトリと骨組み

- [ ] 旧コードを `legacy/` に移す（参照用。Phase 5 の最後に削除する）。**または**、最初のコミットで旧コードを残し、次のコミットで削除する（履歴から参照する）。→ **後者を推奨**（ディレクトリが散らからない）
- [ ] 削除: `supabase/`, `utils/supabase`, `scripts/*`, `todo_list.txt`, `playwright-report/`, `test-results/`, `DEPLOYMENT.md`, `env.example`, `.github/workflows/keep-supabase-active.yml`
- [ ] vinext の骨組み: `package.json`（`"type": "module"`, engines node>=22）、`vite.config.ts`（`vinext()` と `cloudflare()`）、`wrangler.jsonc`（§3.3）、`tsconfig.json`（`wrangler types` の出力を含める）、`.node-version`
- [ ] `.gitignore` に追加: `.wrangler/`, `dist/`, `.dev.vars*`, `playwright-report/`, `test-results/`, `coverage/`
- [ ] Tailwind 4 と shadcn/ui を初期化（`components.json` を再生成）。必要な部品: button, input, label, card, badge, table, dialog, alert-dialog, tabs, select, checkbox, radio-group, sonner, skeleton, separator
- [ ] `lib/env.ts`（型付きの `appEnv()`）
- [ ] `app/layout.tsx`（lang=ja、フォント指定）、`app/api/health/route.ts`
- [ ] ESLint 9 flat config、Prettier、`npm scripts`:
  ```json
  "dev": "vinext dev", "build": "vinext build", "preview": "vinext start",
  "deploy": "vinext-cloudflare deploy",
  "typecheck": "wrangler types && tsc --noEmit",
  "lint": "eslint .", "format": "prettier -w .",
  "test": "vitest run", "test:e2e": "playwright test",
  "db:generate": "drizzle-kit generate",
  "db:migrate:local": "wrangler d1 migrations apply parking --local",
  "db:migrate:remote": "wrangler d1 migrations apply parking --remote",
  "db:seed:local": "wrangler d1 execute parking --local --file=db/seed.dev.sql",
  "db:reset:local": "rm -rf .wrangler/state && npm run db:migrate:local && npm run db:seed:local"
  ```
  （`deploy` の実際のコマンドは、vinext 1.x のドキュメントで確認して固定する）
- [ ] `.github/workflows/ci.yml`（PR: lint → typecheck → test → build → E2E）
- [ ] README（開発手順だけ。設計は docs/design へのリンク）

## Phase 1 — ドメインとDB

- [ ] `lib/domain/time.ts` とテスト（JSTの月の境界、年またぎ、`addMonths(-1)`、`monthsBetween` の端点）
- [ ] `lib/domain/billing.ts`（`billableMonths`, `allocate`）とテスト（一部入金、超過、空）
- [ ] `lib/domain/money.ts`（`formatYen`, `includedTax`）とテスト（3000→272、9000→818）
- [ ] `lib/domain/names.ts`（`normalizeName`: NFKC → 空白（全角・半角）を除去）とテスト
- [ ] `lib/db/schema.ts`（§4.3）→ `drizzle-kit generate` → `migrations/0000_init.sql` を確認する（部分索引とCHECKが出力されているか）
- [ ] `drizzle.config.ts`（`dialect: "sqlite"`, `out: "migrations"`）
- [ ] `db/seed.dev.sql`
- [ ] `lib/services/invoices.ts`（`syncInvoices`, `voidInvoice`, `applyFeeChange`, `shrinkContractPeriod`）
- [ ] `lib/services/audit.ts`
- [ ] 統合テストの基盤: `@cloudflare/vitest-pool-workers`。テストごとにmigrationを適用した D1 を用意する
- [ ] 統合テスト: `syncInvoices` の冪等性、契約期間の変更、料金変更の反映オプション

## Phase 2 — 管理画面

- [ ] `lib/auth/owner.ts`（§5.2）と `proxy.ts`（Access の検証、Origin の検証、ヘッダー）
- [ ] 単体テスト: `verifyOwner`（テスト用の鍵ペアで署名したJWT: 正常 / aud違い / 期限切れ / 許可されていないメール / 本番で設定が無い場合）
- [ ] `lib/validation.ts`（contractor, settings）
- [ ] `/admin/settings`
- [ ] `/admin/contractors`、`/new`、`/[id]`（基本情報タブと請求タブ）
- [ ] `/admin` ダッシュボード（KPIとマトリクス。`services/queries.ts`）
- [ ] 契約者のアーカイブ（`archived_at` を設定し、`session_version` を上げる）
- [ ] 全ての管理系アクションで `requireOwner()` を呼んでいるかのテスト: アクションを列挙し、Ownerが無い状態で呼ぶと拒否されることを確認する

## Phase 3 — 契約者の認証とポータル

- [ ] `lib/auth/login-token.ts`（生成、SHA-256、照合）
- [ ] `lib/auth/contractor-session.ts`（発行、検証、`requireContractor`）
- [ ] `/l/[token]` の Route Handler
- [ ] `/`（予備ログイン）: `LOGIN_LIMITER`、失敗回数とロック、文言の統一
- [ ] 管理画面: ログインタブ（QRの発行・再発行、無効化、ロック解除）、`/login-card` の印刷（`uqr` のSVG）
- [ ] `/portal` の layout（`syncInvoices` と本人の読み込み）とホーム
- [ ] 統合テスト: ロック（5回目の失敗でロックされる / 期限後に解除される）、`session_version` が上がると拒否される、アーカイブ済みは拒否される

## Phase 4 — 入金と領収書

- [ ] `lib/services/payments.ts`: `markSucceeded`、`releaseAllocations`（共通の batch を作る関数）
- [ ] 振込: `/portal/pay`（ステップ1・2）、`/portal/pay/transfer`、`reportTransfer`、管理画面の承認と却下、`/admin/payments`、`/admin/payments/[id]`
- [ ] 現金など: 管理画面の［入金を記録］（`recordManualPayment`）
- [ ] 領収書: `services/receipts.ts`（batch の文を組み立てる）、`components/receipt/Receipt.tsx`、2つのルート
- [ ] カード: `lib/stripe.ts`、`startCardCheckout`、`/portal/payments/[id]/complete`、`/api/webhooks/stripe`
- [ ] 統合テスト（最重要）:
  - 同じ請求に対して pending の入金を2つ作ろうとすると、2つ目が失敗し、何も残らない
  - `fulfillCheckout` を2回呼んでも、入金・配分・領収書は1件ずつ
  - Webhook: `stripe.webhooks.generateTestHeaderString` で署名した本物の形のペイロードで、completed、async_succeeded、async_failed、expired、署名の不正、を確認する
  - 金額が一致しない場合は処理しない
  - 一部入金 → 残りを入金 → 請求が `paid` になり、領収書が2枚になる
  - 却下すると配分が解放され、その月をもう一度支払える
  - 領収書の番号が連番になり、設定を変えても発行済みの領収書は変わらない
- [ ] 手動確認: `stripe listen --forward-to localhost:<port>/api/webhooks/stripe` とテストカード（`4242…`、3Dセキュア `4000 0027 6000 3184`）、`stripe trigger`、`stripe events resend`

## Phase 5 — 仕上げ

- [ ] `/admin/audit`
- [ ] `/legal/tokushoho`、`/legal/privacy`（設定の事業者情報を表示する）
- [ ] E2E（Playwright。vinext dev とシード済みのローカルD1。オーナーはバイパス）:
  1. オーナー: 契約者を登録 → 請求ができる → ログインカードを表示
  2. 契約者: QRのURLでログイン → 振込報告 → オーナーが承認 → 契約者に領収書が表示される
  3. 契約者: 予備ログインで失敗 ×5 → ロックの文言
  4. オーナー: 現金で一部入金 → マトリクスが「一部」→ 残りを入金 →「済」
  5. カード: Stripeのテスト環境まで遷移することだけ確認し、確定処理は統合テストでカバーする
  6. `/admin` は Access のヘッダーが無いと403（`APP_ENV=production` 相当の設定で確認）
- [ ] アクセシビリティ: axe（`@axe-core/playwright`）で契約者の画面に違反が無い。375px幅のスクリーンショットで確認
- [ ] `.github/workflows/deploy.yml`（§8.3）
- [ ] README と docs を実装に合わせて更新する

## Phase 6 — 本番構築とリリース

リリースの手順（Runbook）

1. [ ] GitHubリポジトリを作成してpush（非公開を推奨）。Environment `production` に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を登録する
2. [ ] `wrangler d1 create parking` → `database_id` を `wrangler.jsonc` に書く
3. [ ] Access Application `parking-admin` を作成（§5.2）→ `ACCESS_AUD` と `ACCESS_TEAM_DOMAIN` を `vars` に書く
4. [ ] `wrangler secret put SESSION_SECRET` / `STRIPE_SECRET_KEY`（**テストキー**）/ `STRIPE_WEBHOOK_SECRET`
5. [ ] mainにマージ → CIで migration の適用とデプロイ → スモークテスト
6. [ ] Stripe（テストモード）の Webhook エンドポイントを本番URLで作成し、signing secret を登録し直す
7. [ ] **本番URLで、テストモードのまま全フローを確認**（オーナーの実際のスマホとPCで、Access のログインも含めて）
8. [ ] 確認用のデータを初期化: `wrangler d1 execute parking --remote --command "DELETE FROM ..."`（依存の逆順に消すSQLを `db/reset.sql` として用意しておく）→ `settings` を入れ直す
9. [ ] Stripe本番アカウントの申請が完了していることを確認 → 本番の Webhook エンドポイントを作成 → `STRIPE_SECRET_KEY` と `STRIPE_WEBHOOK_SECRET` を本番の値に差し替える
10. [ ] オーナーが設定と契約者を登録 → ログインカードを印刷して配る
11. [ ] Vercel のプロジェクトと Supabase のプロジェクトを削除する（本番利用していないため、残す必要はない）

## 8.2 テスト方針

| 層           | 道具                                                   | 対象                                                                                               | 目安                      |
| ------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------- |
| 単体         | vitest                                                 | `lib/domain/*`、`verifyOwner`、`normalizeName`                                                     | 分岐をすべて通す          |
| 統合         | vitest + `@cloudflare/vitest-pool-workers`（本物のD1） | `lib/services/*`、Webhook の Route Handler                                                         | §8.1 Phase 4 の項目は必須 |
| E2E          | Playwright + vinext dev                                | 主要な利用者フロー                                                                                 | §8.1 Phase 5 の6本        |
| 本番スモーク | `curl`                                                 | `/api/health` 200、`/` 200、`/admin` がAccessへリダイレクト（302）、`GET /api/webhooks/stripe` 405 | デプロイのたびに実行      |

## 8.3 CI/CD

`ci.yml`（PRごと）: checkout → Node（`.node-version`）→ `npm ci` → lint → typecheck → `vitest run` → build → Playwright（chromium）

`deploy.yml`（mainへのpush）:

```yaml
concurrency: { group: production-deploy, cancel-in-progress: false }
environment: production
steps:
  - npm ci && npm run lint && npm run typecheck && npm test && npm run build
  - run: npx wrangler d1 migrations apply parking --remote # 後方互換の変更だけを許す
  - run: npm run deploy
  - run: ./scripts/smoke.sh https://parking-management.hiraku00.workers.dev
```

**migration のルール**: 列の追加（NULL許可か初期値あり）、テーブルの追加、索引の追加だけを自動で適用します。列の削除や名前の変更は、2回のリリースに分けます（1回目: コード側で使わなくする → 2回目: 削除する）。問題が起きたら D1 Time Travel（`wrangler d1 time-travel restore`）で戻します。

## 8.4 決めておくこと

2026-09-12 にオーナーと確認済み。Q1・Q4 は当初の推奨から変更、Q2・Q3 は推奨どおり採用。

| #   | 項目                                           | 決定                                                                               | 影響                                                                                                           |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Q1  | 前払いにするか（何か月先の分まで請求を作るか） | **有効化**。`invoice_lead_months` の初期値は **1**（翌月分まで請求を作る）         | `settings.invoice_lead_months` は設定画面で後から変更できる（§4.3, §6.2, §7.4）                                |
| Q2  | コンビニ払いなどを有効にするか                 | 推奨どおり、**最初はカードだけ**。必要になれば Stripe 側の設定変更のみで有効化する | コードの変更は不要（§6.4）                                                                                     |
| Q3  | 独自ドメインを使うか                           | 推奨どおり、**`workers.dev` で開始**                                               | 独自ドメインを用意した時点で、オーナー宛のメール通知（v1.1, §1.4）を追加する                                   |
| Q4  | GitHub のリポジトリ名と公開範囲                | `parking-management`、**公開（public）**                                           | 公開リポジトリのため、Secrets・`.dev.vars`・個人情報を含むファイルをコミットしない運用を徹底する（§5.6, §8.5） |
| Q5  | 予備ログイン（氏名＋下4桁）を残すか            | 未決定。推奨: 残す（QRを失くしたときのため）                                       | 設定で無効にできるようにしてもよい                                                                             |
| Q6  | Workers の有料プラン（$5/月）                  | 未決定。推奨: 不要（無料枠で足りる）。Time Travel を30日にしたい場合だけ検討       | –                                                                                                              |

**リポジトリの初期化方針**（今回合意・実施済み）: 旧実装（`parking-management-anti` 由来の Vercel + Supabase 版）は、ビルド成果物や検証用の残骸（`playwright-report/`, `test-results/`, `todo_list.txt` など）を除いてそのまま最初のコミットとして残し、直後のコミットで削除して `docs/design/` に置き換えた。旧実装のソース自体は `main` の1コミット目から `git show <sha>:<path>` などで参照できる。

## 8.5 公開リポジトリとしての注意事項

- `.dev.vars`、`.env*`（本プロジェクトでは `*.local` に限らず全パターンを除外）はコミットしない。`.dev.vars.example` のようにキー名だけを示すテンプレートのみ追跡する。
- `wrangler.jsonc` の `vars` に平文の秘密情報を書かない（Access の AUD やメールアドレスなど、秘密でない設定値のみ）。
- 契約者の実データ（氏名・電話番号）を含むシードや `.sql` ダンプ、テスト証跡（スクリーンショット等）はコミットしない。ローカル専用の `db/seed.dev.sql` はダミーデータのみとする。
- `CLOUDFLARE_API_TOKEN` 等はすべて GitHub Actions の `production` Environment Secrets に置き、リポジトリ変数・コード中には置かない。
