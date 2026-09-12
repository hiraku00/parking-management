# 駐車場管理システム

月極駐車場の契約者管理、毎月の請求、入金（カード決済・銀行振込・現金）、領収書発行を行うWebアプリケーションです。

## 現在のステータス: Phase 0（リポジトリの骨組み）完了

このリポジトリは、Vercel + Supabase で動いていた旧実装を土台に、**Cloudflare上で完結する構成へ全面的に作り替える**ために新規作成しました。本番利用はまだ開始していないため、データ移行は不要です。

vinext + Cloudflare Workers の骨組みができた段階で、画面やDBはまだ実装していません（[08-implementation-plan.md](docs/design/08-implementation-plan.md) の Phase 1 以降）。

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

## 技術スタック（v2）

| 領域         | 採用                                                        |
| ------------ | ----------------------------------------------------------- |
| ホスティング | Cloudflare Workers（vinext）                                |
| DB           | Cloudflare D1 + Drizzle ORM                                 |
| オーナー認証 | Cloudflare Access（`/admin` のみ、パスワード不要）          |
| 契約者認証   | QRコードログイン（主）／氏名＋電話番号下4桁（予備）         |
| 決済         | Stripe Checkout（カード。将来的にコンビニ払い等も追加可能） |
| UI           | Tailwind CSS 4 / shadcn (radix-ui)                          |

決済以外はすべて Cloudflare 上で完結します。詳細と採用理由は [docs/design/README.md](docs/design/README.md) の設計判断一覧を参照してください。

## 開発を始めるには

必要要件: Node.js 22 以上（`.node-version` 参照）

```bash
npm install
npm run dev        # http://localhost:3210 相当のポートで vinext dev サーバーが起動
```

### 検証コマンド

```bash
npm run lint        # ESLint
npm run format      # Prettier（--check）
npm run typecheck   # wrangler types && tsc --noEmit
npm test            # Vitest（ユニットテスト）
npm run build       # vinext build（Worker向けビルド）
npm run test:e2e    # Playwright（ビルド不要、devサーバーを自動起動）
```

D1・Cloudflare Access・Stripeとの連携はまだ設定していません（`wrangler.jsonc` にプレースホルダーとして記載）。実際の値は [08-implementation-plan.md](docs/design/08-implementation-plan.md) の Phase 1〜6 で設定します。

## ライセンス

MIT
