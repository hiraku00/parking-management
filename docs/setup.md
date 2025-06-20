# 開発環境のセットアップ

## 前提条件

- Node.js (v18 以上)
- npm
- Supabase CLI
- Stripe アカウント

## 手順

1. リポジトリのクローン

```bash
git clone https://github.com/hiraku00/parking-management.git
cd parking-management
```

2. 依存関係のインストール

```bash
npm install
```

3. 環境変数の設定

### フロントエンド（React）用

`.env`ファイルを作成し、以下の変数を設定：

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

### Supabase Edge Functions 用

Supabase のダッシュボードで、以下の環境変数を設定：

```env
FRONTEND_URL=http://localhost:5173  # 開発環境
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
MONTHLY_FEE=3500
```

4. Supabase のセットアップ

```bash
# Supabaseプロジェクトのリンク
supabase link --project-ref your-project-ref

# データベースの初期設定（開発環境用）
supabase db reset
```

5. Stripe Webhook の設定
   [Stripe Webhook の設定](./stripe-webhook.md)を参照してください。

6. 開発サーバーの起動

```bash
npm run dev
```

## 補足: 契約者詳細ページへの遷移

契約者一覧画面の「詳細」ボタンを押すと、該当契約者の詳細ページ（/contractor/{契約者名}）に遷移します。

## トラブルシューティング

### Supabase Functions の認証エラー

Stripe Webhook のデプロイ時に認証エラー（401）が発生する場合は、以下のコマンドを使用してください：

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

このオプションは、Stripe Webhook のエンドポイントで JWT 認証をスキップします。これは安全です。なぜなら：

1. Stripe Webhook は署名検証で保護されている
2. Webhook のエンドポイントは公開されている必要がある
3. 不正なリクエストは自動的に拒否される

- DB スキーマやテストデータは`supabase/migrations/schema.sql`、`test_data.sql`で管理しています。
