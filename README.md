# 駐車場管理システム

月極駐車場の契約者管理と月額料金の支払いを管理するWebアプリケーション。

## 機能

### 利用者向け機能
- **名前+電話番号認証**: 名前と電話番号下4桁で安全にログイン（Signed JWTによる改ざん防止済）
- **未払い月の表示**: 契約期間内の未払い月のみを表示し、複数月の一括選択が可能
- **Stripe決済**: クレジットカードによる安全なオンライン決済
- **銀行振込報告**: 銀行振込での支払い報告と承認状況の確認
- **支払い履歴**: 過去の支払い履歴を確認
- **領収書発行**: 支払い履歴から適格請求書対応の領収書を印刷・PDF保存
- **堅牢なバリデーション**: 全ての入力データに対してサーバーサイドでZodによる厳格な検証を実施
- **高齢者対応UI**: IT用語を排除し、直感的に操作できるユニバーサルデザインを採用

### オーナー向け機能
- **契約者管理**: 契約者の追加・編集・削除
- **手動入金消込**: 現金払い等に対応した代理消込機能（部分入金対応）
- **契約期間管理**: 契約開始月・終了月の管理
- **支払い状況確認**: 月ごとの支払い状況（滞納・未払・済）を一覧表示
- **電話番号管理**: 契約者の電話番号を管理

## 技術スタック

- **フロントエンド**: Next.js 15, React, TypeScript, Tailwind CSS
- **バックエンド**: Supabase (PostgreSQL + Auth)
- **バリデーション**: Zod (Type-safe validation)
- **決済**: Stripe
- **セキュリティ**: jose (Signed JWT)
- **テスト**: Vitest (Unit), Playwright (Smoke/E2E)
- **CI/CD**: GitHub Actions (Build, Lint, Smoke Test)
- **デプロイ**: Vercel

## セットアップ

### 必要要件

- Node.js 18+
- Supabaseアカウント
- Stripeアカウント

### 環境変数

プロジェクトルートに`.env.local`ファイルを作成:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Stripe
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app
AUTH_SECRET=your-generated-auth-secret
```

### インストール

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ユニットテストの実行
npm test

# E2Eテストの実行
npm run test:e2e
```

[http://localhost:3000](http://localhost:3000) にアクセスしてアプリケーションを確認できます。

### データベースセットアップ

Supabase SQL Editorで以下のSQLファイルを順番に実行:

1. **`supabase/1-schema.sql`** - テーブル作成
2. **`supabase/2-seed.sql`** - テストデータ挿入
3. **`supabase/3-update_owner_auth.sql`** - オーナーアカウント設定
   - Supabase Auth > Users でオーナーアカウントを作成
   - 作成されたユーザーIDをコピー
   - SQLの`XXXXX`を実際のIDに置き換えて実行

### Stripe Webhook設定

本番環境(Vercel)の場合:
1. [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks) にアクセス
2. エンドポイントを追加: `https://your-domain.vercel.app/api/webhooks/stripe`
3. イベントを選択: `checkout.session.completed`
4. Webhook secretを`STRIPE_WEBHOOK_SECRET`環境変数にコピー

### メンテナンススクリプト

データベースの整合性を確認・修正するためのスクリプトが用意されています：

```bash
# 支払い金額の整合性チェック
node scripts/check-payment-inconsistencies.js

# 不整合の修正（Dry-runモード）
node scripts/fix-payment-inconsistencies.js --dry-run

# 不整合の修正（実行）
node scripts/fix-payment-inconsistencies.js
```

**注意**: 修正スクリプトを実行する前に、必ずデータベースのバックアップを取得してください。

## 使い方

### 利用者の場合

1. ホームページにアクセス
2. 「ポータルにアクセス」をクリック
3. 登録されている名前と電話番号下4桁を入力
   - 例: 名前「田中」、電話番号「5678」
4. 未払いの月額料金を確認して支払い

### オーナーの場合

1. ホームページにアクセス
2. 「オーナーログイン」をクリック
3. メールアドレスとパスワードを入力
4. 契約者の追加・管理と支払い履歴を確認

## デプロイ

### GitHubを使用したデプロイ(推奨)

VercelとGitHubリポジトリを連携している場合、以下のコマンドで自動的にデプロイされます:

```bash
# 変更をコミット
git add .
git commit -m "コミットメッセージ"

# GitHubにプッシュ(自動的にVercelがデプロイを開始)
git push origin main
```

Vercelダッシュボードでデプロイの進捗を確認できます。

### Vercel CLIを使用したデプロイ(代替方法)

GitHubを使用しない場合は、Vercel CLIで直接デプロイできます:

```bash
# Vercel CLIのインストール
npm i -g vercel

# デプロイ
vercel
```

**重要**: Vercelダッシュボードで全ての環境変数を設定してください。

## 開発と運用 (CI/CD)

### 開発ポリシー：安定稼働の徹底
本プロジェクトでは、小規模なシステムながら「止まらない業務システム」を目指し、エンタープライズレベルの品質管理プロセスを導入しています。

### 自動検証プロセス (GitHub Actions)
全てのGitHubプルリクエスト(PR)に対して、以下のワークフローが自動実行されます。この検証が**全て成功（パス）しない限り、本番環境へのマージは技術的にブロックされます。**

1.  **静的解析 (`npm run lint`)**
    - 未使用変数の混入、型定義の不備、コーディング規約違反を検知。
2.  **自動テスト (`npm test`)**
    - 請求計算ロジック (`calculateUnpaidMonths`) や認証基盤など、システムの核心部のデグレを防ぎます。
3.  **本番ビルド検証 (`npm run build`)**
    - **最重要ステップ。** 開発サーバー（`npm run dev`）では許容される曖昧な型定義が、本番用コンパイル（Next.js Turbopack/Webpack）ではエラーとなるケースを防ぎます。

### CI導入の歴史的経緯と再発防止策
**【過去の障害事例】**
以前のアップデートにおいて、「ローカルの開発環境や簡易テストはパスしたものの、本番デプロイ時の厳格なTypeScript型チェック（特に外部SDKであるStripeとの連携部分）でビルドエラーが発生し、デプロイが失敗、業務停止のリスクが生じる」という事象が発生しました。

**【再発防止策としての自動化】**
この教訓に基づき、以下の運用を義務化しています：
- **マージ前ビルドの強制**: GitHub Actionsにより、クラウド上で本番と同じビルドプロセスを再現し、100%の動作を保証します。
- **デベロッパーの責務**: PR作成前に、ローカル環境でも必ず `npm run build` を実行し、型エラーがゼロであることを確認してください。

### CI失敗時の対応
ビルドが失敗した場合は、GitHub Actionsのログを確認し、該当する型不整合やエラーを修正してください。特に、外部ライブラリの型定義変更や、サーバーアクションの引数/戻り値の型不一致が主な原因となります。


## ライセンス

MIT
