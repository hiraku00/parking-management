-- Seed Owner (You must update the auth_id after creating the user in Auth > Users)
-- For now, we insert a placeholder. The user needs to sign up, then update this record.
insert into public.profiles (full_name, role, monthly_fee, phone_number, phone_last4, contract_start_month, contract_end_month, company_name, address, invoice_registration_number, bank_name, bank_branch_name, account_type, account_number, account_holder_name)
values 
('Owner', 'owner', 0, null, null, null, null, '駐車場 管理太郎', '〒100-0001 東京都千代田区千代田1-1', 'T1234567890123', 'みずほ銀行', '丸の内支店', 'ordinary', '1234567', 'チュウシャジョウ　カンリタロウ')
on conflict (full_name) do nothing;

-- Seed Test Contractors
-- We use specific UUIDs to ensure relationships with payments work correctly
insert into public.profiles (id, full_name, role, monthly_fee, phone_number, phone_last4, contract_start_month, contract_end_month)
values 
('defea0fc-d619-4ca7-9f81-854d6e427acb', '田中次郎', 'contractor', 3000, '08012341234', '1234', '2025-12', null),
('3b4d185a-8051-4327-bb2f-521fbc09f4df', '鈴木花子', 'contractor', 3000, '07012341234', '1234', '2025-12', null),
('ff6308b6-4565-4771-810f-1dcafc53a831', '佐々木健太', 'contractor', 3000, '09012341234', '1234', '2025-12', null),
('4a1f37a8-533b-46c8-9c41-5b3f5ebcbe07', '佐藤一郎', 'contractor', 3000, '09087651234', '1234', '2025-05', '2026-12'),
('d110a286-633c-474d-926e-4048f77df4ed', '山田太郎', 'contractor', 3000, '09012341234', '1234', '2025-11', '2026-11'),
('ff0f07aa-e065-4d6a-bc7c-33ed094d7fe1', '大沼その子', 'contractor', 3000, '09012341234', '1234', '2025-08', '2026-07')
on conflict (full_name) do nothing; -- Note: ideally we should upsert on ID, but full_name is unique

-- Seed Payments
insert into public.payments (id, user_id, amount, currency, status, target_month, stripe_session_id, payment_method, created_at)
values
('2771ec09-f800-4199-a511-b5141aa2b96c', '4a1f37a8-533b-46c8-9c41-5b3f5ebcbe07', 3000, 'jpy', 'succeeded', '2025-10', 'manual_entry', 'cash', '2025-12-07 04:38:02.742737+00'),
('3c583302-b5ba-4f57-9a8a-f4fab6f154f3', '4a1f37a8-533b-46c8-9c41-5b3f5ebcbe07', 3000, 'jpy', 'succeeded', '2025-11', 'manual_entry', 'cash', '2025-12-07 04:38:02.090534+00'),
('5bf1471a-d58f-418c-87ca-23184df423aa', 'ff0f07aa-e065-4d6a-bc7c-33ed094d7fe1', 3000, 'jpy', 'succeeded', '2025-12', 'manual_entry', 'cash', '2025-12-07 04:37:42.245194+00'),
('6c272dc8-4d3a-472a-a4d0-7060a59e5eb6', 'ff6308b6-4565-4771-810f-1dcafc53a831', 3000, 'jpy', 'succeeded', '2025-12', 'manual_entry', 'cash', '2025-12-07 04:24:17.555976+00'),
('6e1b3493-0308-4f6d-a047-7f1d24afb40d', '4a1f37a8-533b-46c8-9c41-5b3f5ebcbe07', 3000, 'jpy', 'succeeded', '2025-08', 'manual_entry', 'cash', '2025-12-07 04:38:03.276346+00'),
('77095faa-dd36-4d76-bf4e-a0ea0b6ba9c0', 'defea0fc-d619-4ca7-9f81-854d6e427acb', 3000, 'jpy', 'succeeded', '2025-12', 'cs_test_a12B0m6Vf5PBiBzbgJK0rsqz2mnpVA4n19unuO13EY4mRNnPWXqo0IJsIe', 'stripe', '2025-12-05 11:08:12.088388+00'),
('9a227faa-6fcd-4876-b3e2-6eb6540bf429', '4a1f37a8-533b-46c8-9c41-5b3f5ebcbe07', 3000, 'jpy', 'succeeded', '2025-12', 'cs_test_a1Bdi771sSIKJ7RtAkOAuaXRO81mgsLKrZNOnfRqB0ZNmLvaP2XicZdIgo', 'stripe', '2025-12-06 08:52:41.440544+00'),
('c6704bc5-b700-4635-91fd-e83395e60b02', 'd110a286-633c-474d-926e-4048f77df4ed', 3000, 'jpy', 'succeeded', '2025-11', 'cs_test_a17SjROGMCX8CNuishbXJo5uO05E7DnqdWonCrHJkPH9KnVDZvDfpQxaYt', 'stripe', '2025-12-05 11:21:35.291879+00'),
('d6f4929e-b1dc-4889-8872-47420597506a', 'd110a286-633c-474d-926e-4048f77df4ed', 3000, 'jpy', 'succeeded', '2025-12', 'cs_test_a1LfciilrGXx4Is2VV6W2VlxIPiv5R1KAPBZAL3SydLKHKY4qFogrH4Hh2', 'stripe', '2025-12-05 12:03:30.016008+00')
on conflict (id) do nothing;
