# Stripe Webhook の設定

## 手順

1. Stripe CLI のインストール

```bash
# macOS
brew install stripe/stripe-cli/stripe

# その他のOSは[公式ドキュメント](https://stripe.com/docs/stripe-cli)を参照
```

2. Stripe CLI のログイン

```bash
stripe login
```

3. Webhook の設定

```bash
# 開発環境
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# 本番環境
stripe listen --forward-to https://your-project-ref.supabase.co/functions/v1/stripe-webhook
```

4. Webhook シークレットの取得

```bash
stripe listen --print-secret
```

5. 環境変数の設定
   Supabase のダッシュボードで、以下の環境変数を設定：

```env
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SECRET_KEY=sk_test_...
```

6. Supabase Functions のデプロイ

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

## 支払いフロー

1. 支払い開始

   - 契約者が支払いページで月数を選択
   - Stripe Checkout セッションを作成
   - 契約者を Stripe Checkout ページにリダイレクト

2. 支払い完了

   - 契約者が支払いを完了
   - Stripe Webhook が支払い完了を通知
   - 支払い情報をデータベースに保存
   - 契約者を支払い完了ページにリダイレクト

3. 支払い完了ページ
   - 支払い情報を確認
   - 3 秒後に支払いページに自動リダイレクト

## 注意点

- Webhook のエンドポイントは公開されている必要があります
- 本番環境では、Stripe ダッシュボードで Webhook のエンドポイントを設定してください
- テスト環境では、Stripe CLI を使用して Webhook をローカルに転送できます
- 署名検証は必ず有効にしてください
- 支払い完了後のリダイレクト先は`FRONTEND_URL`環境変数で設定してください
