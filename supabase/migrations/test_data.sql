-- テスト用の契約者データ
insert into public.contractors (name, parking_number)
values
  ('テスト太郎', 'A-001'),
  ('テスト花子', 'A-002'),
  ('テスト次郎', 'B-001');

-- テスト用の支払いデータ
insert into public.payments (contractor_id, amount, year, month, paid_at)
select
  c.id,
  3500,
  2024,
  3,
  now()
from public.contractors c
where c.name = 'テスト太郎';
