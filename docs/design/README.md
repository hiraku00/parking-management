# 駐車場管理システム v2 設計書

Cloudflare上で一から作り直す、月極駐車場の契約・請求・入金管理システムの設計書です。
作成日: 2026-09-12 / ステータス: **実装前の設計（レビュー待ち）**

## 前提

- 元は `parking-management-anti` を clone したもの。新しいリポジトリとして作り直す（2026-09-12 `git init`）。
- Vercel + Supabase 版は本番利用前。**データ移行や互換性の維持は不要**で、まっさらな状態でリリースする。
- 利用者は契約者10名以下とオーナー1名。
- 決済（Stripe）以外は、すべて Cloudflare の上で完結させる。構成は `~/Practice/dashboard` に揃える。

## ドキュメント

| # | ファイル | 内容 |
| --- | --- | --- |
| 1 | [01-requirements.md](01-requirements.md) | 背景、利用者、機能要件、非機能要件、対象外 |
| 2 | [02-review-findings.md](02-review-findings.md) | 旧実装のレビュー結果（不具合・設計上の問題）と、v2での対応 |
| 3 | [03-architecture.md](03-architecture.md) | 技術スタック、Cloudflare構成、ディレクトリ構成、リクエストの流れ |
| 4 | [04-data-model.md](04-data-model.md) | D1スキーマ（Drizzle定義）、不変条件、状態遷移 |
| 5 | [05-auth-security.md](05-auth-security.md) | オーナー／契約者の認証、認可、CSRF、レート制限、ヘッダー |
| 6 | [06-billing-payments.md](06-billing-payments.md) | 請求の生成、カード・振込・現金の各フロー、Stripe連携、領収書 |
| 7 | [07-screens.md](07-screens.md) | 画面とルートの一覧、各画面の仕様、UXの方針 |
| 8 | [08-implementation-plan.md](08-implementation-plan.md) | 実装フェーズ、タスク、完了条件、テスト、CI/CD、リリース手順 |

## 主要な設計判断

| # | 判断 | 採用 | 主な理由 | 退けた案 |
| --- | --- | --- | --- | --- |
| D1 | 実行基盤 | **vinext 1.x + Cloudflare Workers** | dashboardと同じ構成。Next.js互換APIのまま、Workers上で `cloudflare:workers` のbindingを直接使える | OpenNext（vinextで問題が出たときの退避先。アプリ側は標準のNext APIだけで書き、差し替え可能にしておく） |
| D2 | DB | **D1 + Drizzle ORM** | 型安全なクエリ。スキーマ定義からmigrationを生成でき、定義の正が1か所になる（dashboardの二重管理を避ける） | 生SQLのみ、Supabase |
| D3 | 請求モデル | **月次請求（invoices）を実体化し、入金（payments）と入金配分（allocations）で消し込む** | 金額が請求時点で固定される。一部入金、免除、1回の入金で複数月、を正しく扱える | 旧方式（契約期間から未払い月を毎回計算） |
| D4 | オーナー認証 | **Cloudflare Access（`/admin` のみ）＋ アプリ側でJWT検証** | パスワードを持たない。Access の MFA（ワンタイムPIN）をそのまま使える | 自前のパスワード認証、Supabase Auth |
| D5 | 契約者認証 | **ログイン用QRコード（主）＋ 氏名と電話番号下4桁（予備）** | 高齢の利用者はQRを読むだけでログインできる。予備ログインにはレート制限とロックをかける | パスキー（高齢者には難しい）、メールのマジックリンク（契約者がメールを持たないことがある） |
| D6 | セッション | **署名付きCookie（jose）＋ `session_version` で失効** | テーブルを増やさずに、オーナーの操作でログインを無効化できる | D1のセッションテーブル |
| D7 | 決済 | **Stripe Checkout（Stripeのホスト画面）＋ 動的決済手段** | カード情報を一切扱わない。コンビニ払いやPayPayをダッシュボードの設定だけで追加できる | Payment Element（自前UIは不要） |
| D8 | 決済の確定処理 | **Webhookと戻り画面で同じ冪等な関数を呼ぶ** | Webhookが遅れても利用者を待たせない。再送されても二重に計上しない | Webhookだけで確定 |
| D9 | 領収書 | **入金1件につき1枚。連番、発行時点の情報を保存、適格簡易請求書の要件を満たす** | 設定を後から変えても、発行済みの領収書は変わらない | 旧方式（月ごと、UUIDの先頭を番号にしていた） |
| D10 | 請求の生成 | **冪等な `syncInvoices()` を、契約の変更時と画面表示時に呼ぶ（Cronは使わない）** | Cronが失敗する余地がなく、独自のWorker入口も不要になる | 月初に実行するCron |
| D11 | 時刻の扱い | **月の境界はすべて Asia/Tokyo で判定。時刻はUTCのミリ秒で保存** | 旧実装にあった「日本時間で月初の9時間は前月扱い」の不具合をなくす | – |
| D12 | migration の適用 | **CIのデプロイ時に自動適用**（後方互換の変更だけを許す） | 利用者が少なく変更も小さい。問題があれば D1 Time Travel で戻せる | dashboardのような手動適用 |
