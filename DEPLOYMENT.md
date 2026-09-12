# デプロイガイド

## Vercelへのデプロイ手順

### 1. GitHubリポジトリの準備

```bash
# Gitリポジトリの初期化(まだの場合)
git init
git add .
git commit -m "Initial commit"

# GitHubリポジトリにプッシュ
git remote add origin https://github.com/your-username/parking-management-anti.git
git push -u origin main
```

### 2. Vercelプロジェクトの作成

1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. 「New Project」をクリック
3. GitHubリポジトリを選択
4. プロジェクト名を設定
5. 「Deploy」をクリック

### 3. 環境変数の設定

Vercel Dashboard > Settings > Environment Variables で以下を設定:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app
AUTH_SECRET=your-generated-auth-secret
```

**AUTH_SECRETの生成方法**:
```bash
openssl rand -base64 32
```

**重要**: `NEXT_PUBLIC_BASE_URL`は実際のVercel URLに設定してください。

### 4. Stripe Webhookの設定

1. [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks) にアクセス
2. 「Add endpoint」をクリック
3. Endpoint URL: `https://your-domain.vercel.app/api/webhooks/stripe`
4. Events to send: `checkout.session.completed` を選択
5. Signing secretをコピーして、Vercelの`STRIPE_WEBHOOK_SECRET`環境変数に設定

### 5. 再デプロイ

環境変数を設定した後、再デプロイが必要です:

```bash
# コードに変更を加えてプッシュ
git add .
git commit -m "Update environment variables"
git push origin main
```

または、Vercel Dashboardから手動で再デプロイ。

## 自動デプロイ

GitHubリポジトリにプッシュすると、Vercelが自動的にデプロイを開始します:

```bash
git add .
git commit -m "Update features"
git push origin main
```

## トラブルシューティング

### 支払い後にlocalhostにリダイレクトされる

`NEXT_PUBLIC_BASE_URL`が正しく設定されていません。Vercelの環境変数を確認してください。

### Webhook検証エラー

`STRIPE_WEBHOOK_SECRET`が正しく設定されていません。Stripeダッシュボードから最新のsigning secretを取得してください。

### データベース接続エラー

Supabaseの環境変数(`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)を確認してください。
