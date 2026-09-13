ALTER TABLE `contractors` ADD `login_kana_key` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
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
	`payment_due_day` integer,
	`updated_at` integer NOT NULL,
	CONSTRAINT "settings_singleton_chk" CHECK(id = 1),
	CONSTRAINT "settings_payment_due_day_chk" CHECK(payment_due_day IS NULL OR payment_due_day BETWEEN 1 AND 28)
);
--> statement-breakpoint
INSERT INTO `__new_settings`("id", "business_name", "business_address", "business_phone", "invoice_registration_number", "tax_rate", "bank_name", "bank_branch", "bank_account_type", "bank_account_number", "bank_account_holder_kana", "card_payment_enabled", "bank_transfer_enabled", "invoice_lead_months", "payment_due_day", "updated_at") SELECT "id", "business_name", "business_address", "business_phone", "invoice_registration_number", "tax_rate", "bank_name", "bank_branch", "bank_account_type", "bank_account_number", "bank_account_holder_kana", "card_payment_enabled", "bank_transfer_enabled", "invoice_lead_months", "payment_due_day", "updated_at" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;