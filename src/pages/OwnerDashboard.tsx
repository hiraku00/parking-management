import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getUnpaidMonthsFromData } from "../utils/unpaidMonths";
import ContractorCreateForm from "../components/ContractorCreateForm";

interface Contractor {
  id: string;
  name: string;
  parking_number: string;
  contract_start_year: number;
  contract_start_month: number;
  contract_end_year?: number | null;
  contract_end_month?: number | null;
  created_at: string;
  payments?: Payment[];
}

interface Payment {
  id: string;
  year: number;
  month: number;
  amount: number;
  paid_at: string | null;
}

export default function OwnerDashboard() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchContractors = async () => {
    try {
      const { data, error } = await supabase
        .from("contractors")
        .select("*, payments(*)")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setContractors(
        (data || []).sort((a, b) => {
          return Number(a.parking_number) - Number(b.parking_number);
        })
      );
    } catch (err) {
      console.error("Error fetching contractors:", err);
      setError(
        err instanceof Error ? err.message : "契約者データの取得に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContractors();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div
            className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
            role="alert"
          >
            <strong className="font-bold">エラー: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">契約者一覧</h1>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={() => setShowCreateModal(true)}
          >
            ＋新規契約者登録
          </button>
        </div>
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-700 bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-lg relative text-gray-900 border border-gray-200">
              <button
                className="absolute top-3 right-3 bg-red-500 hover:bg-red-600 text-white rounded-full w-9 h-9 flex items-center justify-center text-xl font-bold shadow focus:outline-none"
                onClick={() => setShowCreateModal(false)}
                aria-label="閉じる"
              >
                ×
              </button>
              <h2 className="text-xl font-bold mb-6 text-gray-900">
                新規契約者登録
              </h2>
              <ContractorCreateForm
                onSuccess={() => {
                  setShowCreateModal(false);
                  fetchContractors();
                }}
              />
            </div>
          </div>
        )}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          {contractors.length === 0 ? (
            <div className="bg-white shadow-md rounded-lg p-6 text-center">
              <p className="text-gray-500">契約者が登録されていません</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      契約者名
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      駐車スペース番号
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      契約開始
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      契約終了
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      未払い
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      アクション
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contractors.map((contractor) => (
                    <tr key={contractor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contractor.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contractor.parking_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contractor.contract_start_year}年
                        {contractor.contract_start_month}月
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {contractor.contract_end_year
                          ? `${contractor.contract_end_year}年${contractor.contract_end_month}月`
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(() => {
                          const unpaidMonths = getUnpaidMonthsFromData(
                            contractor,
                            contractor.payments || []
                          );
                          const hasUnpaid = unpaidMonths.length > 0;
                          return (
                            <span
                              className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                                hasUnpaid
                                  ? "bg-red-100 text-red-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {hasUnpaid ? "未払いあり" : "未払いなし"}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          to={`/contractor/${encodeURIComponent(
                            contractor.name
                          )}`}
                          className="text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          詳細を見る
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
