'use server'

import { redirect } from 'next/navigation'
import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { requireContractor } from '@/lib/auth/contractor-session'
import { resumeCardCheckout, cancelCardCheckout } from '@/lib/services/payments'

/** ホームの「お支払いを続ける」から呼ぶ。参照: docs/design/09-ux-improvements.md §9.4.6 */
export async function resumeCardCheckoutAction(paymentId: string): Promise<void> {
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)

  const result = await resumeCardCheckout(db, { paymentId, contractorId: contractor.id, now: new Date() })
  if (result.kind === 'redirect') redirect(result.url)
  if (result.kind === 'completed') redirect(`/portal/payments/${result.paymentId}/complete`)
  redirect('/portal')
}

/** ホームの「やめる」から呼ぶ。 */
export async function cancelCardCheckoutAction(paymentId: string): Promise<void> {
  const db = getDb(appEnv().DB)
  const contractor = await requireContractor(db)

  await cancelCardCheckout(db, { paymentId, contractorId: contractor.id, now: new Date() })
  redirect('/portal')
}
