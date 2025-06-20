-- 既存データをクリア
delete from public.payments;
delete from public.contractors;

-- テストデータの追加
-- 契約者データ
insert into public.contractors (id, name, parking_number, contract_start_year, contract_start_month, contract_end_year, contract_end_month, monthly_fee)
values
  ('11111111-1111-1111-1111-111111111111', 'test1', '1', 2025, 1, null, null, 3500),
  ('22222222-2222-2222-2222-222222222222', 'test2', '2', 2025, 3, null, null, 3500),
  ('33333333-3333-3333-3333-333333333333', 'test3', '3', 2025, 5, 2025, 5, 3500),
  ('44444444-4444-4444-4444-444444444444', 'test4', '4', 2025, 4, null, null, 3500),
  ('55555555-5555-5555-5555-555555555555', 'test5', '5', 2025, 6, null, null, 3500),
  ('66666666-6666-6666-6666-666666666666', 'test6', '3', 2025, 6, null, null, 3500);

-- 支払いデータ
insert into public.payments (contractor_id, amount, year, month, paid_at)
values
  -- test1: 2025/1,2,3支払い済み、4,5未払い
  ('11111111-1111-1111-1111-111111111111', 3500, 2025, 1, '2025-01-15 10:00:00+09'),
  ('11111111-1111-1111-1111-111111111111', 3500, 2025, 2, '2025-02-15 10:00:00+09'),
  ('11111111-1111-1111-1111-111111111111', 3500, 2025, 3, '2025-03-15 10:00:00+09'),
  -- test2: 2025/3のみ支払い済み、4,5未払い
  ('22222222-2222-2222-2222-222222222222', 3500, 2025, 3, '2025-03-15 10:00:00+09'),
  -- test3: 2025/5のみ支払い済み、他未払い（契約終了2025/5なので未払いなし）
  ('33333333-3333-3333-3333-333333333333', 3500, 2025, 5, '2025-05-15 10:00:00+09'),
  -- test4: 2025/4,5支払い済み、6未払い
  ('44444444-4444-4444-4444-444444444444', 3500, 2025, 4, '2025-04-15 10:00:00+09'),
  ('44444444-4444-4444-4444-444444444444', 3500, 2025, 5, '2025-05-15 10:00:00+09')
  -- test5, 6: 全て未払い
  -- データなし
;
