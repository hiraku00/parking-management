-- 更新日時を自動設定する関数
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 既存のオブジェクトを削除（依存関係を考慮）
drop view if exists public.payment_status;
drop table if exists public.payments;
drop table if exists public.contractors;

-- 契約者テーブル
create table if not exists public.contractors (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  parking_number text not null,
  contract_start_year integer not null,
  contract_start_month integer not null,
  contract_end_year integer,
  contract_end_month integer,
  monthly_fee integer not null default 0,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  check (contract_start_month between 1 and 12),
  check (contract_end_month between 1 and 12 or contract_end_month is null)
);

-- 支払いテーブル
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

-- 支払い状況ビュー
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

-- RLSポリシーの設定
alter table public.contractors enable row level security;
alter table public.payments enable row level security;

-- 既存のポリシーを削除
drop policy if exists "Contractors can view their own data" on public.contractors;
drop policy if exists "Contractors can view their own payments" on public.payments;
drop policy if exists "Contractors can insert their own payments" on public.payments;

-- 新しいポリシーを作成
create policy "Anyone can view contractors by name"
  on public.contractors for select
  using (true);

create policy "Anyone can view payments"
  on public.payments for select
  using (true);

create policy "Contractors can insert their own payments"
  on public.payments for insert
  with check (auth.uid() = contractor_id);

-- 開発用: 全員insert許可（本番では削除・修正すること）
create policy "Allow insert for all"
  on public.contractors for inserte
  with check (true);

-- トリガーの設定
drop trigger if exists set_updated_at on public.contractors;
drop trigger if exists set_updated_at on public.payments;

create trigger set_updated_at
  before update on public.contractors
  for each row
  execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.payments
  for each row
  execute function public.set_updated_at();

