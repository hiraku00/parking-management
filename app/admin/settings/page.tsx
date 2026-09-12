import { appEnv } from '@/lib/env'
import { getDb } from '@/lib/db/client'
import { getSettings } from '@/lib/services/settings'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const db = getDb(appEnv().DB)
  const settings = await getSettings(db)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">設定</h1>
        <p className="text-sm text-slate-500">事業者情報や振込先口座の管理を行えます。</p>
      </div>
      <SettingsForm initialData={settings} />
    </div>
  )
}
