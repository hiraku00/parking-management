-- D1 は `PRAGMA foreign_keys=OFF` が効かない（マイグレーションがトランザクション内で
-- 実行されるため）。`payments` を DROP すると、子テーブル（payment_allocations /
-- receipts）に行がある本番では外部キー違反になる（Deploy #30・#31 の失敗原因）。
-- そこで `defer_foreign_keys` で違反の検査をコミット時まで遅らせ、旧テーブルを DROP した
-- 後に「同じ名前の」テーブルへ行を入れ直して、違反を解消してからコミットする。
-- `__new_*` を RENAME する方式だと、入れ直し先の名前が違うため違反が解消されず失敗する。
-- この設定はコミット（またはロールバック）で自動的に元に戻る。
PRAGMA defer_foreign_keys=on;--> statement-breakpoint
CREATE TABLE `__backup_payments` AS SELECT "id", "contractor_id", "method", "channel", "status", "amount", "stripe_checkout_session_id", "stripe_payment_intent_id", "stripe_payment_method_type", "payer_name", "paid_on", "note", "reviewed_by", "reviewed_at", "reject_reason", "succeeded_at", "created_at", "updated_at" FROM `payments`;--> statement-breakpoint
DROP TABLE `payments`;--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`contractor_id` text NOT NULL,
	`method` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`amount` integer NOT NULL,
	`stripe_checkout_session_id` text,
	`stripe_payment_intent_id` text,
	`stripe_payment_method_type` text,
	`stripe_refund_id` text,
	`payer_name` text,
	`paid_on` text,
	`note` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`reject_reason` text,
	`succeeded_at` integer,
	`refunded_at` integer,
	`refunded_by` text,
	`refund_reason` text,
	`refund_method` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`contractor_id`) REFERENCES `contractors`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payments_amount_chk" CHECK(amount > 0),
	CONSTRAINT "payments_method_chk" CHECK(method IN ('card','bank_transfer','cash','other')),
	CONSTRAINT "payments_status_chk" CHECK(status IN ('pending','succeeded','failed','canceled','rejected','refunded')),
	CONSTRAINT "payments_refund_method_chk" CHECK(refund_method IS NULL OR refund_method IN ('card','bank_transfer','cash'))
);
--> statement-breakpoint
-- 元のdrizzle-kit生成SQLは、新規列（stripe_refund_id等）を旧テーブルに
-- 存在しない列名としてSELECT側にも書いていた。SQLiteはダブルクォートで
-- 囲んだ識別子が列名として解決できないとき、警告なく文字列リテラルとして
-- 扱ってしまう既知の癖があり（例: "refund_method" → 文字列 'refund_method'）、
-- そのままではCHECK制約違反やゴミ値の混入を招く。新規列は退避するSELECT側から外し、
-- INSERT対象の列リストからも省略することで、正しくNULL（またはDEFAULT）が入るようにする。
INSERT INTO `payments`("id", "contractor_id", "method", "channel", "status", "amount", "stripe_checkout_session_id", "stripe_payment_intent_id", "stripe_payment_method_type", "payer_name", "paid_on", "note", "reviewed_by", "reviewed_at", "reject_reason", "succeeded_at", "created_at", "updated_at") SELECT "id", "contractor_id", "method", "channel", "status", "amount", "stripe_checkout_session_id", "stripe_payment_intent_id", "stripe_payment_method_type", "payer_name", "paid_on", "note", "reviewed_by", "reviewed_at", "reject_reason", "succeeded_at", "created_at", "updated_at" FROM `__backup_payments`;--> statement-breakpoint
DROP TABLE `__backup_payments`;--> statement-breakpoint
CREATE UNIQUE INDEX `payments_checkout_session_uq` ON `payments` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `payments_contractor_created_idx` ON `payments` (`contractor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE TABLE `__new_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_no` integer NOT NULL,
	`kind` text DEFAULT 'receipt' NOT NULL,
	`payment_id` text NOT NULL,
	`issued_at` integer NOT NULL,
	`transaction_date` text NOT NULL,
	`recipient_name` text NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`tax_rate` integer NOT NULL,
	`tax_amount` integer NOT NULL,
	`payment_method_label` text NOT NULL,
	`issuer` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "receipts_kind_chk" CHECK(kind IN ('receipt','credit_note'))
);
--> statement-breakpoint
-- 同じ理由で "kind" もSELECT側から外す（省略すると列のDEFAULT 'receipt' が入る）。
INSERT INTO `__new_receipts`("id", "receipt_no", "payment_id", "issued_at", "transaction_date", "recipient_name", "description", "amount", "tax_rate", "tax_amount", "payment_method_label", "issuer", "created_at") SELECT "id", "receipt_no", "payment_id", "issued_at", "transaction_date", "recipient_name", "description", "amount", "tax_rate", "tax_amount", "payment_method_label", "issuer", "created_at" FROM `receipts`;--> statement-breakpoint
DROP TABLE `receipts`;--> statement-breakpoint
ALTER TABLE `__new_receipts` RENAME TO `receipts`;--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_no_uq` ON `receipts` (`receipt_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_payment_kind_uq` ON `receipts` (`payment_id`,`kind`);