import { ContractorForm } from '../contractor-form'
import { createContractorAction } from '../actions'

export default function NewContractorPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">契約者を追加</h1>
      <div className="rounded-lg border bg-white p-6">
        <ContractorForm action={createContractorAction} submitLabel="登録する" />
      </div>
    </div>
  )
}
