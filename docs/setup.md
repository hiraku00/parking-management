# 開発環境のセットアップ

## 前提条件

- Node.js (v18 以上)
- npm
- Supabase CLI
- Stripe アカウント

## 手順

1. リポジトリのクローン

```bash
git clone <repository-url>
cd parking-management
```

2. 依存関係のインストール

```bash
npm install
```

3. 環境変数の設定
   `.env`ファイルを作成し、以下の変数を設定：

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
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
