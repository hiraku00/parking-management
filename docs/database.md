# データベースの初期設定

## 本番環境

1. データベースの初期化

```bash
# スキーマのみを適用（テストデータは投入しない）
supabase db reset --no-seed
```

このコマンドは以下の処理を実行します：

- `schema.sql`の実行（テーブル構造、RLS ポリシー、トリガーなど）

## 開発環境

1. データベースの初期化

```bash
# スキーマとテストデータを適用
supabase db reset
```

このコマンドは以下の処理を実行します：

- `schema.sql`の実行（テーブル構造、RLS ポリシー、トリガーなど）
- `test_data.sql`の実行（テストデータの投入）

## テーブル構造

### contractors

```sql
create table if not exists public.contractors (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  parking_number text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
```

### payments

```sql
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  contractor_id uuid references public.contractors(id) not null,
  amount integer not null,
  year integer not null,
  month integer not null,
  paid_at timestamp with time zone,
  stripe_payment_intent_id text,
  stripe_session_id text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  unique(contractor_id, year, month)
);
```

#### payments テーブルのカラム説明

- `id`: 支払い ID（UUID）
- `contractor_id`: 契約者 ID（外部キー）
- `amount`: 支払い金額（円）
- `year`: 支払い年
- `month`: 支払い月
- `paid_at`: 支払い完了日時
- `stripe_payment_intent_id`: Stripe 決済 ID
- `stripe_session_id`: Stripe Checkout セッション ID（支払い完了後のリダイレクト先の特定に使用）
- `created_at`: レコード作成日時
- `updated_at`: レコード更新日時

## 支払い完了時の処理フロー

1. Stripe Webhook が支払い完了を通知
2. Webhook ハンドラーが`stripe_session_id`を使用して支払い情報を特定
3. 支払い情報をデータベースに保存
4. 契約者を支払い完了ページにリダイレクト

## セキュリティ設定

### RLS ポリシー

- 契約者は自分のデータのみ閲覧可能
- 契約者は自分の支払い情報のみ閲覧可能
- 契約者は自分の支払い情報のみ登録可能

### トリガー

- 更新日時（`updated_at`）の自動設定

## 注意点

- 本番環境では、必ずバックアップを取得してから`db reset`を実行してください
- 本番環境では`--no-seed`オプションを使用して、テストデータを投入しないようにしてください
- 開発環境では`test_data.sql`を使用して、テストデータを投入してください
- スキーマの変更は`schema.sql`で管理されています
- `stripe_session_id`は支払い完了後のリダイレクト先の特定に使用されるため、必ず保存してください
