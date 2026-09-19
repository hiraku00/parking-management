# 駐車場管理システム

月極駐車場の契約者管理、毎月の請求、入金（カード決済・銀行振込・現金）、領収書発行を行うWebアプリケーションです。

## 現在のステータス: Phase 6（本番構築）テストモード検証完了

このリポジトリは、Vercel + Supabase で動いていた旧実装を土台に、**Cloudflare上で完結する構成へ全面的に作り替える**ために新規作成しました。本番利用はまだ開始していないため、データ移行は不要です。

契約者管理・請求生成・入金（カード決済／銀行振込／現金）・領収書発行・監査ログ・特定商取引法/プライバシーポリシーの表示まで実装済みで、E2Eテストとアクセシビリティ確認も揃っています。本番のCloudflare D1・Access・Stripe（テストモード）も構築済みで、実URL上でQRログイン→カード決済（Stripeサンドボックス）→領収書発行までの一連の動作を確認しています（[08-implementation-plan.md](docs/design/08-implementation-plan.md) Phase 0〜6）。

残るのは、確認用データの初期化と、Stripe本番アカウントの申請・切り替え、旧Vercel/Supabaseプロジェクトの削除です（同Runbook 8〜11）。

- 旧実装（Next.js 16 + Supabase + Stripe / Vercel）は、このリポジトリの最初のコミットにそのまま残しています。参照する場合は `git log` の最初のコミットを確認してください。
- v2 の設計は [docs/design/](docs/design/README.md) にまとまっています。実装はこの設計に沿って進めます。

## 設計ドキュメント

| #   | ドキュメント                                                       | 内容                                           |
| --- | ------------------------------------------------------------------ | ---------------------------------------------- |
| 1   | [01-requirements.md](docs/design/01-requirements.md)               | 背景、利用者、機能・非機能要件                 |
| 2   | [02-review-findings.md](docs/design/02-review-findings.md)         | 旧実装のレビュー結果と対応方針                 |
| 3   | [03-architecture.md](docs/design/03-architecture.md)               | 技術スタック、Cloudflare構成、ディレクトリ構成 |
| 4   | [04-data-model.md](docs/design/04-data-model.md)                   | D1スキーマ（Drizzle）、不変条件、状態遷移      |
| 5   | [05-auth-security.md](docs/design/05-auth-security.md)             | オーナー／契約者の認証・認可・CSRF・レート制限 |
| 6   | [06-billing-payments.md](docs/design/06-billing-payments.md)       | 請求生成、決済フロー、Stripe連携、領収書       |
| 7   | [07-screens.md](docs/design/07-screens.md)                         | 画面・ルート一覧とUX方針                       |
| 8   | [08-implementation-plan.md](docs/design/08-implementation-plan.md) | 実装フェーズ、テスト計画、CI/CD、リリース手順  |
| 9   | [09-ux-improvements.md](docs/design/09-ux-improvements.md)         | UX改善計画（契約者のスマホ体験）               |
| 10  | [10-design-system.md](docs/design/10-design-system.md)             | デザインシステム（トークン・部品・UD不変条件） |
| 11  | [11-ui-redesign.md](docs/design/11-ui-redesign.md)                 | 画面別のUI再設計                               |
| 12  | [12-review-followups.md](docs/design/12-review-followups.md)       | 実装レビューで出た論点と対応設計               |

## 技術スタック（v2）

| 領域         | 採用                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------- |
| ホスティング | Cloudflare Workers（vinext）                                                                  |
| DB           | Cloudflare D1 + Drizzle ORM                                                                   |
| オーナー認証 | Cloudflare Access（`/admin` のみ、パスワード不要）                                            |
| 契約者認証   | QRコードログイン（主）／氏名＋電話番号下4桁（予備）                                           |
| 決済         | Stripe Checkout（カード。将来的にコンビニ払い等も追加可能）                                   |
| UI           | Tailwind CSS 4 ＋ 手書きの意味的CSS（Apple／デジ庁調のデザインシステム。Radixは挙動のみ利用） |

決済以外はすべて Cloudflare 上で完結します。詳細と採用理由は [docs/design/README.md](docs/design/README.md) の設計判断一覧を参照してください。

## 開発を始めるには

必要要件: Node.js 22 以上（`.node-version` 参照）

```bash
npm install
npm run dev        # http://localhost:3210 相当のポートで vinext dev サーバーが起動
```

### 検証コマンド

```bash
npm run lint             # ESLint
npm run format           # Prettier（--check）
npm run typecheck        # wrangler types && tsc --noEmit
npm test                 # Vitest（ユニットテスト）
npm run test:integration # Vitest + Miniflare（D1を使う統合テスト）
npm run build            # vinext build（Worker向けビルド）
npm run test:e2e         # Playwright（ビルド不要、devサーバーを自動起動）
```

E2E（`e2e/parking.pw.ts`）は、オーナー登録→請求、QRログイン→振込報告→承認→領収書、予備ログインのロック、現金の一部入金→完済、契約者向け画面のアクセシビリティ（axe、375px幅）を確認します。`.dev.vars` が無い環境（CIなど）では `scripts/ensure-dev-vars.mjs` がE2E専用の非機密なダミー値を自動生成します。カード決済がStripeのCheckoutページへ遷移することを確認するテストは、実際のStripeテストキーが必要なため既定では実行しません（`STRIPE_TEST_MODE=1` を設定すると実行されます）。

D1・Cloudflare Access・Stripeとの連携はローカル開発用のプレースホルダー止まりです（`wrangler.jsonc`）。本番の値は [08-implementation-plan.md](docs/design/08-implementation-plan.md) の Phase 6（本番構築とリリース）で設定します。`.github/workflows/deploy.yml` は `main` へのpushで自動デプロイしますが、`production` Environment に `CLOUDFLARE_API_TOKEN` 等が登録されるまでは各ステップをスキップします。

## ライセンス

MIT
