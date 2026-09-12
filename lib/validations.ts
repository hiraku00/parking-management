import { z } from 'zod'

/**
 * Validation schemas for all server actions
 * Following MAG7 standards: type-safe, reusable, and self-documenting
 */

// ============================================================================
// Authentication Schemas
// ============================================================================

export const ownerLoginSchema = z.object({
    email: z.string().email('有効なメールアドレスを入力してください'),
    password: z.string().min(1, 'パスワードを入力してください'),
})

export const contractorLoginSchema = z.object({
    name: z.string().min(1, '名前を入力してください'),
    phone: z.string().regex(/^\d{4}$/, '電話番号の下4桁を入力してください'),
})

// ============================================================================
// Contractor Management Schemas
// ============================================================================

export const addContractorSchema = z.object({
    name: z.string().min(1, '名前を入力してください'),
    phoneNumber: z.string().min(1, '電話番号を入力してください'),
    monthlyFee: z.coerce.number().int().positive('月額料金は正の整数である必要があります'),
    contractStart: z.string().regex(/^\d{4}-\d{2}$/, '契約開始月は YYYY-MM 形式で入力してください'),
    contractEnd: z.string().regex(/^\d{4}-\d{2}$/, '契約終了月は YYYY-MM 形式で入力してください').optional().or(z.literal('')),
})

export const updateContractorSchema = addContractorSchema.extend({
    id: z.string().uuid('無効な契約者IDです'),
})

export const deleteContractorSchema = z.object({
    id: z.string().uuid('無効な契約者IDです'),
})

// ============================================================================
// Payment Schemas
// ============================================================================

export const createCheckoutSessionSchema = z.object({
    months: z.string().transform((str, ctx) => {
        try {
            const parsed = JSON.parse(str)
            if (!Array.isArray(parsed) || parsed.length === 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: '少なくとも1ヶ月を選択してください',
                })
                return z.NEVER
            }
            // Validate each month format
            const monthRegex = /^\d{4}-\d{2}$/
            for (const month of parsed) {
                if (typeof month !== 'string' || !monthRegex.test(month)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: '月は YYYY-MM 形式である必要があります',
                    })
                    return z.NEVER
                }
            }
            return parsed as string[]
        } catch {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: '無効な月データです',
            })
            return z.NEVER
        }
    }),
})

export const reportBankTransferSchema = z.object({
    contractorId: z.string().uuid('無効な契約者IDです'),
    months: z.string().transform((str, ctx) => {
        try {
            const parsed = JSON.parse(str)
            if (!Array.isArray(parsed) || parsed.length === 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: '少なくとも1ヶ月を選択してください',
                })
                return z.NEVER
            }
            return parsed as string[]
        } catch {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: '無効な月データです',
            })
            return z.NEVER
        }
    }),
    transferName: z.string().min(1, '振込名義を入力してください'),
    transferDate: z.string().min(1, '振込日を入力してください'),
})

export const createManualPaymentSchema = z.object({
    userId: z.string().uuid('無効なユーザーIDです'),
    amount: z.coerce.number().int().positive('金額は正の整数である必要があります'),
    targetMonth: z.string().regex(/^\d{4}-\d{2}$/, '対象月は YYYY-MM 形式で入力してください'),
    paymentMethod: z.enum(['cash', 'bank_transfer', 'other']).default('cash'),
})

export const approvePaymentsSchema = z.object({
    paymentIds: z.array(z.string().uuid('無効な支払いIDです')).min(1, '少なくとも1件の支払いを選択してください'),
})

// ============================================================================
// Owner Settings Schema
// ============================================================================

export const updateOwnerSettingsSchema = z.object({
    companyName: z.string().min(1, '会社名を入力してください'),
    address: z.string().min(1, '住所を入力してください'),
    invoiceNumber: z.string().optional().or(z.literal('')),
    bankName: z.string().min(1, '銀行名を入力してください'),
    branchName: z.string().min(1, '支店名を入力してください'),
    accountType: z.enum(['普通', '当座'], { message: '口座種別を選択してください' }),
    accountNumber: z.string().min(1, '口座番号を入力してください'),
    accountHolder: z.string().min(1, '口座名義を入力してください'),
})

// ============================================================================
// Helper Types (for TypeScript inference)
// ============================================================================

export type OwnerLoginInput = z.infer<typeof ownerLoginSchema>
export type ContractorLoginInput = z.infer<typeof contractorLoginSchema>
export type AddContractorInput = z.infer<typeof addContractorSchema>
export type UpdateContractorInput = z.infer<typeof updateContractorSchema>
export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>
export type ReportBankTransferInput = z.infer<typeof reportBankTransferSchema>
export type CreateManualPaymentInput = z.infer<typeof createManualPaymentSchema>
export type UpdateOwnerSettingsInput = z.infer<typeof updateOwnerSettingsSchema>
