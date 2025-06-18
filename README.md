# 駐車場管理システム

駐車場の契約者管理と支払い管理を行う Web アプリケーションです。

## 機能

- 契約者管理
  - 契約者の登録・編集・削除
  - 契約者一覧の表示
  - 契約者ごとの詳細情報表示
- 支払い管理
  - 月額料金の支払い（Stripe 決済）
  - 支払い履歴の表示
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

# その他
VITE_SITE_URL=http://localhost:5173
```

### インストール

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

## デプロイ

### Vercel へのデプロイ

1. Vercel CLI のインストール

```bash
npm install -g vercel
```

2. デプロイ

```bash
vercel
```

### 注意点

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
