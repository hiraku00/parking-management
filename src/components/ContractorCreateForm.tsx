import { useState } from "react";
import { createContractor } from "../services/contractorService";
import { CreateContractorInput } from "../services/contractorService";

const initialState: CreateContractorInput = {
  name: "",
  parking_number: "",
  contract_start_year: new Date().getFullYear(),
  contract_start_month: new Date().getMonth() + 1,
  contract_end_year: null,
  contract_end_month: null,
  monthly_fee: 0,
};

export default function ContractorCreateForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const [form, setForm] = useState<CreateContractorInput>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name.includes("year") ||
        name.includes("month") ||
        name === "monthly_fee"
          ? value === ""
            ? null
            : Number(value)
          : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // 必須バリデーション
      if (
        !form.name ||
        !form.parking_number ||
        !form.contract_start_year ||
        !form.contract_start_month ||
        !form.monthly_fee
      ) {
        setError("必須項目をすべて入力してください");
        setLoading(false);
        return;
      }
      await createContractor(form);
      setForm(initialState);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 w-full">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          契約者名 <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          className="border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white text-gray-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          駐車場番号 <span className="text-red-500">*</span>
        </label>
        <input
          name="parking_number"
          value={form.parking_number}
          onChange={handleChange}
          className="border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white text-gray-900"
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            契約開始年 <span className="text-red-500">*</span>
          </label>
          <input
            name="contract_start_year"
            type="number"
            value={form.contract_start_year ?? ""}
            onChange={handleChange}
            className="border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white text-gray-900"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            契約開始月 <span className="text-red-500">*</span>
          </label>
          <input
            name="contract_start_month"
            type="number"
            min={1}
            max={12}
            value={form.contract_start_month ?? ""}
            onChange={handleChange}
            className="border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white text-gray-900"
          />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            契約終了年
          </label>
          <input
            name="contract_end_year"
            type="number"
            value={form.contract_end_year ?? ""}
            onChange={handleChange}
            className="border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white text-gray-900"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            契約終了月
          </label>
          <input
            name="contract_end_month"
            type="number"
            min={1}
            max={12}
            value={form.contract_end_month ?? ""}
            onChange={handleChange}
            className="border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white text-gray-900"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          月額料金（円） <span className="text-red-500">*</span>
        </label>
        <input
          name="monthly_fee"
          type="number"
          value={form.monthly_fee}
          onChange={handleChange}
          className="border border-gray-300 rounded-md p-2 w-full focus:ring-2 focus:ring-blue-200 focus:border-blue-400 bg-white text-gray-900"
        />
      </div>
      {error && (
        <div className="text-red-600 text-sm font-medium mt-2">{error}</div>
      )}
      <button
        type="submit"
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-semibold w-full disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={loading}
      >
        {loading ? "登録中..." : "登録"}
      </button>
    </form>
  );
}
