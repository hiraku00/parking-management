-- ローカル開発専用のダミーデータ。本番には決して投入しない。
-- 実行: npm run db:seed:local （内部で `wrangler d1 execute parking --local` を使う）
-- 月はすべて実行時点（UTC基準。JSTとの数時間のズレはローカル確認用途では無視する）からの
-- 相対値で計算しているので、いつ実行しても「今月」を含む妥当な状態になる。
-- 参照: docs/design/04-data-model.md §4.7

-- ─── 設定 ──────────────────────────────────────────────────────────
INSERT INTO settings (
  id, business_name, business_address, business_phone, invoice_registration_number,
  tax_rate, bank_name, bank_branch, bank_account_type, bank_account_number,
  bank_account_holder_kana, card_payment_enabled, bank_transfer_enabled,
  invoice_lead_months, updated_at
) VALUES (
  1, '駐車場 管理太郎', '〒100-0001 東京都千代田区千代田1-1', '03-1234-5678', 'T1234567890123',
  10, 'みずほ銀行', '丸の内支店', '普通', '1234567',
  'チュウシャジョウ カンリタロウ', 1, 1,
  1, unixepoch('now') * 1000
);

-- ─── 契約者A: 田中太郎（滞納あり・振込確認待ちを含む）────────────────
INSERT INTO contractors (
  id, name, name_kana, login_key, phone, phone_last4, space_label, monthly_fee,
  contract_start_month, contract_end_month, created_at, updated_at
) VALUES (
  'seed-contractor-tanaka', '田中太郎', 'タナカ タロウ', '田中太郎', '09012340001', '0001', 'A-1', 3000,
  strftime('%Y-%m', 'now', '-4 months'), NULL,
  unixepoch('now') * 1000, unixepoch('now') * 1000
);

INSERT INTO invoices (id, contractor_id, month, amount, status, paid_at, created_at, updated_at) VALUES
  ('seed-inv-tanaka-m4', 'seed-contractor-tanaka', strftime('%Y-%m', 'now', '-4 months'), 3000, 'paid', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed-inv-tanaka-m3', 'seed-contractor-tanaka', strftime('%Y-%m', 'now', '-3 months'), 3000, 'open', NULL, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed-inv-tanaka-m2', 'seed-contractor-tanaka', strftime('%Y-%m', 'now', '-2 months'), 3000, 'open', NULL, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed-inv-tanaka-m1', 'seed-contractor-tanaka', strftime('%Y-%m', 'now', '-1 months'), 3000, 'open', NULL, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed-inv-tanaka-m0', 'seed-contractor-tanaka', strftime('%Y-%m', 'now'), 3000, 'open', NULL, unixepoch('now') * 1000, unixepoch('now') * 1000);

-- 4か月前の分は現金で受領済み
INSERT INTO payments (id, contractor_id, method, channel, status, amount, reviewed_by, reviewed_at, succeeded_at, created_at, updated_at) VALUES
  ('seed-pay-tanaka-cash', 'seed-contractor-tanaka', 'cash', 'admin', 'succeeded', 3000, 'owner:hiraku00@gmail.com', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000);
INSERT INTO payment_allocations (payment_id, invoice_id, amount, state) VALUES
  ('seed-pay-tanaka-cash', 'seed-inv-tanaka-m4', 3000, 'applied');
INSERT INTO receipts (id, receipt_no, payment_id, issued_at, transaction_date, recipient_name, description, amount, tax_rate, tax_amount, payment_method_label, issuer, created_at) VALUES
  ('seed-receipt-tanaka', 1, 'seed-pay-tanaka-cash', unixepoch('now') * 1000, date('now', '-4 months'), '田中太郎',
   '駐車場使用料 ' || strftime('%Y', 'now', '-4 months') || '年' || CAST(strftime('%m', 'now', '-4 months') AS INTEGER) || '月分（区画A-1）',
   3000, 10, 272, '現金', '{"businessName":"駐車場 管理太郎","address":"〒100-0001 東京都千代田区千代田1-1","phone":"03-1234-5678","registrationNumber":"T1234567890123"}',
   unixepoch('now') * 1000);

-- 3か月前の分は銀行振込を報告済み（オーナーの確認待ち）
INSERT INTO payments (id, contractor_id, method, channel, status, amount, payer_name, paid_on, created_at, updated_at) VALUES
  ('seed-pay-tanaka-transfer', 'seed-contractor-tanaka', 'bank_transfer', 'portal', 'pending', 3000, 'タナカ タロウ', date('now', '-3 months'), unixepoch('now') * 1000, unixepoch('now') * 1000);
INSERT INTO payment_allocations (payment_id, invoice_id, amount, state) VALUES
  ('seed-pay-tanaka-transfer', 'seed-inv-tanaka-m3', 3000, 'pending');

-- ─── 契約者B: 鈴木花子（当月だけ未払い）──────────────────────────────
INSERT INTO contractors (
  id, name, name_kana, login_key, phone, phone_last4, space_label, monthly_fee,
  contract_start_month, contract_end_month, created_at, updated_at
) VALUES (
  'seed-contractor-suzuki', '鈴木花子', 'スズキ ハナコ', '鈴木花子', '09012340002', '0002', 'A-2', 3000,
  strftime('%Y-%m', 'now', '-2 months'), NULL,
  unixepoch('now') * 1000, unixepoch('now') * 1000
);

INSERT INTO invoices (id, contractor_id, month, amount, status, paid_at, created_at, updated_at) VALUES
  ('seed-inv-suzuki-m2', 'seed-contractor-suzuki', strftime('%Y-%m', 'now', '-2 months'), 3000, 'paid', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed-inv-suzuki-m1', 'seed-contractor-suzuki', strftime('%Y-%m', 'now', '-1 months'), 3000, 'paid', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed-inv-suzuki-m0', 'seed-contractor-suzuki', strftime('%Y-%m', 'now'), 3000, 'open', NULL, unixepoch('now') * 1000, unixepoch('now') * 1000);

INSERT INTO payments (id, contractor_id, method, channel, status, amount, reviewed_by, reviewed_at, succeeded_at, created_at, updated_at) VALUES
  ('seed-pay-suzuki-cash', 'seed-contractor-suzuki', 'cash', 'admin', 'succeeded', 6000, 'owner:hiraku00@gmail.com', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000);
INSERT INTO payment_allocations (payment_id, invoice_id, amount, state) VALUES
  ('seed-pay-suzuki-cash', 'seed-inv-suzuki-m2', 3000, 'applied'),
  ('seed-pay-suzuki-cash', 'seed-inv-suzuki-m1', 3000, 'applied');
INSERT INTO receipts (id, receipt_no, payment_id, issued_at, transaction_date, recipient_name, description, amount, tax_rate, tax_amount, payment_method_label, issuer, created_at) VALUES
  ('seed-receipt-suzuki', 2, 'seed-pay-suzuki-cash', unixepoch('now') * 1000, date('now', '-1 months'), '鈴木花子',
   '駐車場使用料 2か月分（区画A-2）', 6000, 10, 545, '現金',
   '{"businessName":"駐車場 管理太郎","address":"〒100-0001 東京都千代田区千代田1-1","phone":"03-1234-5678","registrationNumber":"T1234567890123"}',
   unixepoch('now') * 1000);

-- ─── 契約者C: 佐々木健太（すべてカードで支払済み）────────────────────
INSERT INTO contractors (
  id, name, name_kana, login_key, phone, phone_last4, space_label, monthly_fee,
  contract_start_month, contract_end_month, created_at, updated_at
) VALUES (
  'seed-contractor-sasaki', '佐々木健太', 'ササキ ケンタ', '佐々木健太', '09012340003', '0003', 'B-1', 3000,
  strftime('%Y-%m', 'now', '-3 months'), NULL,
  unixepoch('now') * 1000, unixepoch('now') * 1000
);

INSERT INTO invoices (id, contractor_id, month, amount, status, paid_at, created_at, updated_at) VALUES
  ('seed-inv-sasaki-m3', 'seed-contractor-sasaki', strftime('%Y-%m', 'now', '-3 months'), 3000, 'paid', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed-inv-sasaki-m2', 'seed-contractor-sasaki', strftime('%Y-%m', 'now', '-2 months'), 3000, 'paid', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed-inv-sasaki-m1', 'seed-contractor-sasaki', strftime('%Y-%m', 'now', '-1 months'), 3000, 'paid', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed-inv-sasaki-m0', 'seed-contractor-sasaki', strftime('%Y-%m', 'now'), 3000, 'paid', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000);

INSERT INTO payments (id, contractor_id, method, channel, status, amount, stripe_checkout_session_id, stripe_payment_intent_id, stripe_payment_method_type, succeeded_at, created_at, updated_at) VALUES
  ('seed-pay-sasaki-card', 'seed-contractor-sasaki', 'card', 'portal', 'succeeded', 12000, 'cs_test_seed_sasaki', 'pi_test_seed_sasaki', 'card', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000);
INSERT INTO payment_allocations (payment_id, invoice_id, amount, state) VALUES
  ('seed-pay-sasaki-card', 'seed-inv-sasaki-m3', 3000, 'applied'),
  ('seed-pay-sasaki-card', 'seed-inv-sasaki-m2', 3000, 'applied'),
  ('seed-pay-sasaki-card', 'seed-inv-sasaki-m1', 3000, 'applied'),
  ('seed-pay-sasaki-card', 'seed-inv-sasaki-m0', 3000, 'applied');
INSERT INTO receipts (id, receipt_no, payment_id, issued_at, transaction_date, recipient_name, description, amount, tax_rate, tax_amount, payment_method_label, issuer, created_at) VALUES
  ('seed-receipt-sasaki', 3, 'seed-pay-sasaki-card', unixepoch('now') * 1000, date('now'), '佐々木健太',
   '駐車場使用料 4か月分（区画B-1）', 12000, 10, 1090, 'クレジットカード',
   '{"businessName":"駐車場 管理太郎","address":"〒100-0001 東京都千代田区千代田1-1","phone":"03-1234-5678","registrationNumber":"T1234567890123"}',
   unixepoch('now') * 1000);

-- ─── 契約者D: 大沼その子（契約終了・アーカイブ済み）──────────────────
INSERT INTO contractors (
  id, name, name_kana, login_key, phone, phone_last4, space_label, monthly_fee,
  contract_start_month, contract_end_month, archived_at, created_at, updated_at
) VALUES (
  'seed-contractor-onuma', '大沼その子', 'オオヌマ ソノコ', '大沼その子', '09012340004', '0004', 'B-2', 3000,
  strftime('%Y-%m', 'now', '-6 months'), strftime('%Y-%m', 'now', '-1 months'), unixepoch('now') * 1000,
  unixepoch('now') * 1000, unixepoch('now') * 1000
);

INSERT INTO invoices (id, contractor_id, month, amount, status, paid_at, created_at, updated_at) VALUES
  ('seed-inv-onuma-m2', 'seed-contractor-onuma', strftime('%Y-%m', 'now', '-2 months'), 3000, 'paid', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000),
  ('seed-inv-onuma-m1', 'seed-contractor-onuma', strftime('%Y-%m', 'now', '-1 months'), 3000, 'paid', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000);

INSERT INTO payments (id, contractor_id, method, channel, status, amount, reviewed_by, reviewed_at, succeeded_at, created_at, updated_at) VALUES
  ('seed-pay-onuma-cash', 'seed-contractor-onuma', 'cash', 'admin', 'succeeded', 6000, 'owner:hiraku00@gmail.com', unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000, unixepoch('now') * 1000);
INSERT INTO payment_allocations (payment_id, invoice_id, amount, state) VALUES
  ('seed-pay-onuma-cash', 'seed-inv-onuma-m2', 3000, 'applied'),
  ('seed-pay-onuma-cash', 'seed-inv-onuma-m1', 3000, 'applied');
INSERT INTO receipts (id, receipt_no, payment_id, issued_at, transaction_date, recipient_name, description, amount, tax_rate, tax_amount, payment_method_label, issuer, created_at) VALUES
  ('seed-receipt-onuma', 4, 'seed-pay-onuma-cash', unixepoch('now') * 1000, date('now', '-1 months'), '大沼その子',
   '駐車場使用料 2か月分（区画B-2）', 6000, 10, 545, '現金',
   '{"businessName":"駐車場 管理太郎","address":"〒100-0001 東京都千代田区千代田1-1","phone":"03-1234-5678","registrationNumber":"T1234567890123"}',
   unixepoch('now') * 1000);

-- ─── 契約者E: 山田太郎（来月開始・まだ請求は無い）────────────────────
-- syncInvoices() を呼ぶと、前払い設定（invoice_lead_months=1）により
-- 開始月（来月）の請求が1件作られる。ここでは意図的に請求を入れていない。
INSERT INTO contractors (
  id, name, name_kana, login_key, phone, phone_last4, space_label, monthly_fee,
  contract_start_month, contract_end_month, created_at, updated_at
) VALUES (
  'seed-contractor-yamada', '山田太郎', 'ヤマダ タロウ', '山田太郎', '09012340005', '0005', 'C-1', 3000,
  strftime('%Y-%m', 'now', '+1 months'), NULL,
  unixepoch('now') * 1000, unixepoch('now') * 1000
);
