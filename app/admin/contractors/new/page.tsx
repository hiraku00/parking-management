import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ContractorForm } from '../contractor-form'
import { createContractorAction } from '../actions'

export default function NewContractorPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">契約者を追加</h1>
      <Card>
        <CardHeader>
          <CardTitle>新しい契約者を登録</CardTitle>
          <CardDescription>契約者は名前と電話番号下4桁でログインできます。</CardDescription>
        </CardHeader>
        <CardContent>
          <ContractorForm action={createContractorAction} submitLabel="登録する" />
        </CardContent>
      </Card>
    </div>
  )
}
