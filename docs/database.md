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
  name text unique not null, -- 契約者名
  parking_number text not null, -- 駐車場番号
  contract_start_year integer not null, -- 契約開始年
  contract_start_month integer not null, -- 契約開始月(1-12)
  contract_end_year integer, -- 契約終了年（NULLなら継続中）
  contract_end_month integer, -- 契約終了月（NULLなら継続中）
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  check (contract_start_month between 1 and 12),
  check (contract_end_month between 1 and 12 or contract_end_month is null)
);
```

### payments

```sql
create table if not exists public.payments (
  id uuid default gen_random_uuid() primary key,
  contractor_id uuid references public.contractors(id) not null, -- 契約者ID
  amount integer not null, -- 支払い金額
  year integer not null, -- 支払い年
  month integer not null, -- 支払い月
  paid_at timestamp with time zone, -- 支払い完了日時
  stripe_payment_intent_id text, -- Stripe決済ID
  stripe_session_id text, -- StripeセッションID
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  unique(contractor_id, year, month)
);
```

### [view] payment_status

```sql
create or replace view public.payment_status as
select
  c.id as contractor_id,
  c.name,
  c.parking_number,
  c.contract_start_year,
  c.contract_start_month,
  c.contract_end_year,
  c.contract_end_month,
  p.year,
  p.month,
  p.amount,
  p.paid_at,
  case
    when p.paid_at is not null then 'paid'
    when p.year < extract(year from now()) or
         (p.year = extract(year from now()) and p.month <= extract(month from now()))
    then 'unpaid'
    else 'future'
  end as status
from
  public.contractors c
  left join public.payments p on c.id = p.contractor_id
where
  p.year >= c.contract_start_year and
  (p.year > c.contract_start_year or p.month >= c.contract_start_month) and
  (c.contract_end_year is null or
   p.year < c.contract_end_year or
   (p.year = c.contract_end_year and p.month <= c.contract_end_month));
```

## カラム説明

#### contractors

- id: 契約者 ID（UUID, PK）
- name: 契約者名（ユニーク）
- parking_number: 駐車場番号
- contract_start_year/month: 契約開始年月
- contract_end_year/month: 契約終了年月（NULL なら継続中）
- created_at/updated_at: レコード作成・更新日時

#### payments

- id: 支払い ID（UUID, PK）
- contractor_id: 契約者 ID（FK）
- amount: 支払い金額（円）
- year/month: 支払い年月
- paid_at: 支払い完了日時（NULL なら未払い）
- stripe_payment_intent_id: Stripe 決済 ID
- stripe_session_id: Stripe セッション ID
- created_at/updated_at: レコード作成・更新日時

## 画面遷移仕様補足

契約者一覧画面の「詳細」ボタンを押すと、該当契約者の詳細ページ（/contractor/{契約者名}）に遷移します。

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
