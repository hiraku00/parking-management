import { z } from 'zod'
import { isValidYearMonth } from './domain/time'

/**
 * サーバーアクションの入力検証スキーマ。フォーム側でも同じスキーマを使う。
 * 参照: docs/design/04-data-model.md §4.3, docs/design/07-screens.md §7.4
 */

const yearMonth = z.string().trim().refine(isValidYearMonth, { message: 'YYYY-MM形式で入力してください' })

export const contractorInputSchema = z
  .object({
    name: z.string().trim().min(1, '氏名を入力してください').max(100),
    nameKana: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((v) => (v ? v : null)),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9-]{10,15}$/, '電話番号を正しく入力してください'),
    spaceLabel: z
      .string()
      .trim()
      .max(50)
      .optional()
      .transform((v) => (v ? v : null)),
    monthlyFee: z.coerce.number().int().positive('月額料金は1円以上で入力してください'),
    contractStartMonth: yearMonth,
    contractEndMonth: z
      .union([yearMonth, z.literal('')])
      .optional()
      .transform((v) => (v ? v : null)),
    note: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .refine((v) => !v.contractEndMonth || v.contractEndMonth >= v.contractStartMonth, {
    message: '契約終了月は契約開始月以降にしてください',
    path: ['contractEndMonth'],
  })

export type ContractorInput = z.infer<typeof contractorInputSchema>

export const feeChangeSchema = z.object({
  contractorId: z.string().min(1),
  newFee: z.coerce.number().int().positive('月額料金は1円以上で入力してください'),
  applyToOpenInvoices: z.coerce.boolean().default(false),
})

export const archiveContractorSchema = z.object({
  contractorId: z.string().min(1),
})

export const voidInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
  reason: z.string().trim().min(1, '免除の理由を入力してください').max(500),
})

export const settingsInputSchema = z.object({
  businessName: z.string().trim().min(1, '屋号・会社名を入力してください').max(100),
  businessAddress: z.string().trim().max(200).optional().default(''),
  businessPhone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null)),
  invoiceRegistrationNumber: z
    .union([
      z
        .string()
        .trim()
        .regex(/^T\d{13}$/, '登録番号は T+13桁で入力してください'),
      z.literal(''),
    ])
    .optional()
    .transform((v) => (v ? v : null)),
  taxRate: z.coerce.number().int().min(0).max(100).default(10),
  bankName: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((v) => (v ? v : null)),
  bankBranch: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((v) => (v ? v : null)),
  bankAccountType: z
    .union([z.enum(['普通', '当座']), z.literal('')])
    .optional()
    .transform((v) => (v ? v : null)),
  bankAccountNumber: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => (v ? v : null)),
  bankAccountHolderKana: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : null)),
  cardPaymentEnabled: z.coerce.boolean().default(true),
  bankTransferEnabled: z.coerce.boolean().default(true),
  invoiceLeadMonths: z.coerce.number().int().min(0).max(12).default(1),
})

export type SettingsInput = z.infer<typeof settingsInputSchema>
