import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * このファイルがスキーマの正。`npm run db:generate`（drizzle-kit generate）で
 * migrations/*.sql を生成し、`wrangler d1 migrations apply` で適用する。
 * 参照: docs/design/04-data-model.md
 */

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())
const ts = (name: string) => integer(name, { mode: 'timestamp_ms' })
const createdAt = () =>
  ts('created_at')
    .notNull()
    .$defaultFn(() => new Date())
const updatedAt = () =>
  ts('updated_at')
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
/**
 * YYYY-MM 形式かどうかをSQLite側でも検証する（月は 01〜12）。
 * GLOBの文字クラスだけでは "01〜12" を厳密に表現できない
 * （`[01][0-9]` は "00"〜"19" にもマッチしてしまい、"13"〜"19" を通してしまう）。
 * 形式チェックをGLOBで行い、月の範囲は数値として BETWEEN 1 AND 12 で検証する。
 */
const YM = (col: string) =>
  sql.raw(
    `${col} GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]' AND CAST(substr(${col}, 6, 2) AS INTEGER) BETWEEN 1 AND 12`,
  )

// ─── 契約者 ───────────────────────────────────────────────
export const contractors = sqliteTable(
  'contractors',
  {
    id: id(),
    name: text('name').notNull(), // 表示名（例: 田中 太郎）
    nameKana: text('name_kana'), // 並び替えと振込名義の照合用（任意）
    loginKey: text('login_key').notNull(), // normalizeName(name)（NFKC、空白除去）
    loginKanaKey: text('login_kana_key'), // normalizeKana(nameKana)。予備ログインのフリガナ照合用（任意）
    phone: text('phone').notNull(),
    phoneLast4: text('phone_last4').notNull(),
    spaceLabel: text('space_label'), // 区画（例: "A-3"）
    monthlyFee: integer('monthly_fee').notNull(), // 次に請求を作るときの月額
    contractStartMonth: text('contract_start_month').notNull(),
    contractEndMonth: text('contract_end_month'), // null = 無期限
    note: text('note'),
    sessionVersion: integer('session_version').notNull().default(1),
    loginTokenHash: text('login_token_hash'), // SHA-256(base64url)。QRログイン用
    loginTokenIssuedAt: ts('login_token_issued_at'),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: ts('locked_until'),
    archivedAt: ts('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // アーカイブ済みの人とは同名でも登録できるよう、部分UNIQUEにする
    uniqueIndex('contractors_login_key_uq')
      .on(t.loginKey)
      .where(sql`archived_at IS NULL`),
    uniqueIndex('contractors_login_token_uq').on(t.loginTokenHash),
    check('contractors_fee_chk', sql`monthly_fee > 0`),
    check('contractors_start_chk', YM('contract_start_month')),
    check(
      'contractors_end_chk',
      sql`contract_end_month IS NULL OR (${YM('contract_end_month')} AND contract_end_month >= contract_start_month)`,
    ),
    check('contractors_last4_chk', sql`phone_last4 GLOB '[0-9][0-9][0-9][0-9]'`),
  ],
)

// ─── 月次請求 ─────────────────────────────────────────────
export const invoices = sqliteTable(
  'invoices',
  {
    id: id(),
    contractorId: text('contractor_id')
      .notNull()
      .references(() => contractors.id),
    month: text('month').notNull(), // YYYY-MM（対象月）
    amount: integer('amount').notNull(), // 請求を作った時点で固定する
    status: text('status', { enum: ['open', 'paid', 'void'] })
      .notNull()
      .default('open'),
    paidAt: ts('paid_at'),
    voidedAt: ts('voided_at'),
    voidReason: text('void_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('invoices_contractor_month_uq').on(t.contractorId, t.month),
    index('invoices_status_month_idx').on(t.status, t.month),
    check('invoices_amount_chk', sql`amount > 0`),
    check('invoices_month_chk', YM('month')),
    check('invoices_status_chk', sql`status IN ('open','paid','void')`),
  ],
)

// ─── 入金 ─────────────────────────────────────────────────
export const PAYMENT_METHODS = ['card', 'bank_transfer', 'cash', 'other'] as const
export const PAYMENT_STATUSES = [
  'pending',
  'succeeded',
  'failed',
  'canceled',
  'rejected',
  'refunded',
] as const

export const payments = sqliteTable(
  'payments',
  {
    id: id(),
    contractorId: text('contractor_id')
      .notNull()
      .references(() => contractors.id),
    method: text('method', { enum: PAYMENT_METHODS }).notNull(),
    channel: text('channel', { enum: ['portal', 'admin'] }).notNull(), // 誰が起点になったか
    status: text('status', { enum: PAYMENT_STATUSES }).notNull(),
    amount: integer('amount').notNull(),
    // Stripe
    stripeCheckoutSessionId: text('stripe_checkout_session_id'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripePaymentMethodType: text('stripe_payment_method_type'), // card / konbini / paypay …
    stripeRefundId: text('stripe_refund_id'),
    // 振込・現金
    payerName: text('payer_name'), // 振込名義
    paidOn: text('paid_on'), // 振込日・受領日（YYYY-MM-DD、JST）
    note: text('note'),
    // 審査
    reviewedBy: text('reviewed_by'), // オーナーのメール
    reviewedAt: ts('reviewed_at'),
    rejectReason: text('reject_reason'),
    succeededAt: ts('succeeded_at'),
    // 返金（succeeded からのみ遷移。docs/design/12-review-followups.md §12.2）
    refundedAt: ts('refunded_at'),
    refundedBy: text('refunded_by'), // オーナーのメール
    refundReason: text('refund_reason'),
    refundMethod: text('refund_method', { enum: ['card', 'bank_transfer', 'cash'] }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('payments_checkout_session_uq').on(t.stripeCheckoutSessionId),
    index('payments_contractor_created_idx').on(t.contractorId, t.createdAt),
    index('payments_status_idx').on(t.status),
    check('payments_amount_chk', sql`amount > 0`),
    check('payments_method_chk', sql`method IN ('card','bank_transfer','cash','other')`),
    check(
      'payments_status_chk',
      sql`status IN ('pending','succeeded','failed','canceled','rejected','refunded')`,
    ),
    check(
      'payments_refund_method_chk',
      sql`refund_method IS NULL OR refund_method IN ('card','bank_transfer','cash')`,
    ),
  ],
)

// ─── 入金配分（どの請求にいくら充てたか）─────────────────
export const paymentAllocations = sqliteTable(
  'payment_allocations',
  {
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id),
    amount: integer('amount').notNull(),
    // 入金の状態を写したもの: pending=確保中 / applied=消込済み / released=解放済み
    state: text('state', { enum: ['pending', 'applied', 'released'] }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.paymentId, t.invoiceId] }),
    index('allocations_invoice_idx').on(t.invoiceId, t.state),
    // 1つの請求を確保できる「処理中の入金」は1件だけ（二重決済をDBで防ぐ）
    uniqueIndex('allocations_one_pending_per_invoice_uq')
      .on(t.invoiceId)
      .where(sql`state = 'pending'`),
    check('allocations_amount_chk', sql`amount > 0`),
  ],
)

// ─── 領収書（入金1件につき1枚、発行時の情報を保存）───────
export type IssuerSnapshot = {
  businessName: string
  address: string
  phone: string | null
  registrationNumber: string | null
}

// 'receipt' = 通常の領収書 / 'credit_note' = 返金時の適格返還請求書。
// 入金1件につき、各kindは1枚まで（返金した入金は領収書1枚＋返還請求書1枚を持てる）。
export const RECEIPT_KINDS = ['receipt', 'credit_note'] as const

export const receipts = sqliteTable(
  'receipts',
  {
    id: id(),
    receiptNo: integer('receipt_no').notNull(), // 連番（1, 2, 3…。領収書・返還請求書で共通の通し番号）
    kind: text('kind', { enum: RECEIPT_KINDS }).notNull().default('receipt'),
    paymentId: text('payment_id')
      .notNull()
      .references(() => payments.id),
    issuedAt: ts('issued_at').notNull(),
    transactionDate: text('transaction_date').notNull(), // 取引日（YYYY-MM-DD、JST）
    recipientName: text('recipient_name').notNull(),
    description: text('description').notNull(), // 例: 駐車場使用料 2026年10月分〜12月分（区画A-3）
    amount: integer('amount').notNull(),
    taxRate: integer('tax_rate').notNull(), // 10
    taxAmount: integer('tax_amount').notNull(), // 内税額 = floor(amount * rate / (100 + rate))
    paymentMethodLabel: text('payment_method_label').notNull(),
    issuer: text('issuer', { mode: 'json' }).notNull().$type<IssuerSnapshot>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('receipts_no_uq').on(t.receiptNo),
    uniqueIndex('receipts_payment_kind_uq').on(t.paymentId, t.kind),
    check('receipts_kind_chk', sql`kind IN ('receipt','credit_note')`),
  ],
)

// ─── 設定（1行だけ）──────────────────────────────────────
export const settings = sqliteTable(
  'settings',
  {
    id: integer('id').primaryKey(), // 常に 1
    businessName: text('business_name').notNull().default(''),
    businessAddress: text('business_address').notNull().default(''),
    businessPhone: text('business_phone'),
    invoiceRegistrationNumber: text('invoice_registration_number'), // T + 13桁
    taxRate: integer('tax_rate').notNull().default(10),
    bankName: text('bank_name'),
    bankBranch: text('bank_branch'),
    bankAccountType: text('bank_account_type', { enum: ['普通', '当座'] }),
    bankAccountNumber: text('bank_account_number'),
    bankAccountHolderKana: text('bank_account_holder_kana'),
    cardPaymentEnabled: integer('card_payment_enabled', { mode: 'boolean' }).notNull().default(true),
    bankTransferEnabled: integer('bank_transfer_enabled', { mode: 'boolean' }).notNull().default(true),
    invoiceLeadMonths: integer('invoice_lead_months').notNull().default(1), // 何か月先の分まで請求を作るか（前払い。初期値1=翌月分まで）
    paymentDueDay: integer('payment_due_day'), // 支払期日（1〜28）。NULLは月末
    updatedAt: updatedAt(),
  },
  () => [
    check('settings_singleton_chk', sql`id = 1`),
    check('settings_payment_due_day_chk', sql`payment_due_day IS NULL OR payment_due_day BETWEEN 1 AND 28`),
  ],
)

// ─── 監査ログ ─────────────────────────────────────────────
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: id(),
    actor: text('actor').notNull(), // owner:<email> | contractor:<id> | stripe | system
    action: text('action').notNull(), // 例: payment.approve, contractor.update
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    detail: text('detail', { mode: 'json' }).$type<Record<string, unknown>>(),
    dedupeKey: text('dedupe_key'), // Webhook等の重複を防ぐ（例: stripe event id）
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_entity_idx').on(t.entityType, t.entityId),
    index('audit_created_idx').on(t.createdAt),
    uniqueIndex('audit_dedupe_uq').on(t.dedupeKey),
  ],
)

// ─── Stripeイベントの受信記録（重複排除と調査用）─────────
export const stripeEvents = sqliteTable('stripe_events', {
  id: text('id').primaryKey(), // evt_...
  type: text('type').notNull(),
  paymentId: text('payment_id'),
  receivedAt: ts('received_at')
    .notNull()
    .$defaultFn(() => new Date()),
})
