# 駐車場管理システム

駐車場の契約者管理と支払い管理を行う Web アプリケーションです。

## 主な機能

- 契約者管理
  - 契約者の登録・編集・削除
  - 契約者一覧の表示（契約開始月・終了月、未払い有無バッジ付き）
  - 契約者ごとの詳細情報表示（契約期間、未払い年月リスト、支払履歴）
- 支払い管理
  - 月額料金の支払い（Stripe 決済）
  - 支払い履歴の表示
  - 未払い年月のリストアップと選択支払い
  - 領収書の PDF ダウンロード

## 技術スタック

- フロントエンド
  - React
  - TypeScript
  - Vite
  - Tailwind CSS
- バックエンド
  - Supabase
  - Stripe
- その他
  - GitHub Actions（CI/CD）

## セットアップ

### 前提条件

- Node.js 18 以上
- npm または yarn
- Supabase アカウント
- Stripe アカウント

### 環境変数の設定

`.env`ファイルを作成し、以下の環境変数を設定してください：

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

### インストール

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

## デプロイ

### Supabase へのデプロイ

1. Supabase CLI のインストール

```bash
# macOS
brew install supabase/tap/supabase

# その他のOSは[公式ドキュメント](https://supabase.com/docs/guides/cli)を参照
```

2. プロジェクトのリンク

```bash
supabase link --project-ref your-project-ref
```

3. データベースのデプロイ

```bash
# 開発環境
supabase db reset

# 本番環境
supabase db reset --no-seed
```

4. Edge Functions のデプロイ

```bash
# Stripe Webhook
supabase functions deploy stripe-webhook --no-verify-jwt

# チェックアウトセッション作成
supabase functions deploy create-checkout-session
```

## DB スキーマ概要

- contractors テーブル：契約者情報（契約開始/終了年月、駐車場番号など）
- payments テーブル：支払い情報（年月、金額、Stripe 連携情報など）
- payment_status ビュー：契約者ごとの支払い状況（未払い・支払い済み・将来分）

詳細は`docs/database.md`を参照してください。

## 注意点

- 本番環境では必ず環境変数を設定してください
- Stripe の Webhook エンドポイントを設定してください
- Supabase のマイグレーションを実行してください

## 開発時の注意点

1. 環境変数

   - `.env`ファイルは Git にコミットしないでください
   - 本番環境用の環境変数は適切に管理してください

2. データベース

   - マイグレーションファイルは`supabase/migrations`ディレクトリに配置してください
   - 本番環境のデータベースを直接操作しないでください

3. 支払い処理

   - テスト時は Stripe のテストモードを使用してください
   - 本番環境では必ず本番用の API キーを使用してください

4. セキュリティ
   - 機密情報は環境変数として管理してください
   - 適切なアクセス制御を実装してください

## ライセンス

MIT License
