CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`detail` text,
	`dedupe_key` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `audit_dedupe_uq` ON `audit_logs` (`dedupe_key`);--> statement-breakpoint
CREATE TABLE `contractors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_kana` text,
	`login_key` text NOT NULL,
	`phone` text NOT NULL,
	`phone_last4` text NOT NULL,
	`space_label` text,
	`monthly_fee` integer NOT NULL,
	`contract_start_month` text NOT NULL,
	`contract_end_month` text,
	`note` text,
	`session_version` integer DEFAULT 1 NOT NULL,
	`login_token_hash` text,
	`login_token_issued_at` integer,
	`failed_login_count` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "contractors_fee_chk" CHECK(monthly_fee > 0),
	CONSTRAINT "contractors_start_chk" CHECK(contract_start_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' AND CAST(substr(contract_start_month, 6, 2) AS INTEGER) BETWEEN 1 AND 12),
	CONSTRAINT "contractors_end_chk" CHECK(contract_end_month IS NULL OR (contract_end_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' AND CAST(substr(contract_end_month, 6, 2) AS INTEGER) BETWEEN 1 AND 12 AND contract_end_month >= contract_start_month)),
	CONSTRAINT "contractors_last4_chk" CHECK(phone_last4 GLOB '[0-9][0-9][0-9][0-9]')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contractors_login_key_uq` ON `contractors` (`login_key`) WHERE archived_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `contractors_login_token_uq` ON `contractors` (`login_token_hash`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`contractor_id` text NOT NULL,
	`month` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`paid_at` integer,
	`voided_at` integer,
	`void_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`contractor_id`) REFERENCES `contractors`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invoices_amount_chk" CHECK(amount > 0),
	CONSTRAINT "invoices_month_chk" CHECK(month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' AND CAST(substr(month, 6, 2) AS INTEGER) BETWEEN 1 AND 12),
	CONSTRAINT "invoices_status_chk" CHECK(status IN ('open','paid','void'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_contractor_month_uq` ON `invoices` (`contractor_id`,`month`);--> statement-breakpoint
CREATE INDEX `invoices_status_month_idx` ON `invoices` (`status`,`month`);--> statement-breakpoint
CREATE TABLE `payment_allocations` (
	`payment_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`amount` integer NOT NULL,
	`state` text NOT NULL,
	PRIMARY KEY(`payment_id`, `invoice_id`),
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "allocations_amount_chk" CHECK(amount > 0)
);
--> statement-breakpoint
CREATE INDEX `allocations_invoice_idx` ON `payment_allocations` (`invoice_id`,`state`);--> statement-breakpoint
CREATE UNIQUE INDEX `allocations_one_pending_per_invoice_uq` ON `payment_allocations` (`invoice_id`) WHERE state = 'pending';--> statement-breakpoint
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
	`payer_name` text,
	`paid_on` text,
	`note` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`reject_reason` text,
	`succeeded_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`contractor_id`) REFERENCES `contractors`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payments_amount_chk" CHECK(amount > 0),
	CONSTRAINT "payments_method_chk" CHECK(method IN ('card','bank_transfer','cash','other')),
	CONSTRAINT "payments_status_chk" CHECK(status IN ('pending','succeeded','failed','canceled','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_checkout_session_uq` ON `payments` (`stripe_checkout_session_id`);--> statement-breakpoint
CREATE INDEX `payments_contractor_created_idx` ON `payments` (`contractor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_no` integer NOT NULL,
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
	FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_no_uq` ON `receipts` (`receipt_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_payment_uq` ON `receipts` (`payment_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`business_name` text DEFAULT '' NOT NULL,
	`business_address` text DEFAULT '' NOT NULL,
	`business_phone` text,
	`invoice_registration_number` text,
	`tax_rate` integer DEFAULT 10 NOT NULL,
	`bank_name` text,
	`bank_branch` text,
	`bank_account_type` text,
	`bank_account_number` text,
	`bank_account_holder_kana` text,
	`card_payment_enabled` integer DEFAULT true NOT NULL,
	`bank_transfer_enabled` integer DEFAULT true NOT NULL,
	`invoice_lead_months` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "settings_singleton_chk" CHECK(id = 1)
);
--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payment_id` text,
	`received_at` integer NOT NULL
);
