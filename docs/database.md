# データベースの初期設定

## 本番環境

1. データベースの初期化

```bash
# initial_setup.sqlのみを実行
supabase db reset --no-seed
```

このコマンドは以下の処理を実行します：

- `initial_setup.sql`の実行（テーブル構造、RLS ポリシー、トリガーなど）

## 開発環境

1. データベースの初期化

```bash
# initial_setup.sqlとseed.sqlを実行
supabase db reset
```

このコマンドは以下の処理を実行します：

- `initial_setup.sql`の実行（テーブル構造、RLS ポリシー、トリガーなど）
- `seed.sql`の実行（テストデータの投入）

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
- 開発環境では`seed.sql`を使用して、テストデータを投入してください
- スキーマの変更は`initial_setup.sql`で管理されています
