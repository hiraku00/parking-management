-- 契約者テーブル
create table if not exists public.contractors (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  parking_number text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
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

-- RLSポリシー
alter table public.contractors enable row level security;
alter table public.payments enable row level security;

-- 契約者テーブルのポリシー
create policy "契約者は自分のデータのみ閲覧可能"
  on public.contractors
  for select
  using (auth.uid() = id);

-- 支払いテーブルのポリシー
create policy "契約者は自分の支払い情報のみ閲覧可能"
  on public.payments
  for select
  using (auth.uid() = contractor_id);

create policy "契約者は自分の支払い情報のみ登録可能"
  on public.payments
  for insert
  with check (auth.uid() = contractor_id);

-- 更新日時の自動設定
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.contractors
  for each row
  execute function public.handle_updated_at();

create trigger set_updated_at
  before update on public.payments
  for each row
  execute function public.handle_updated_at();
