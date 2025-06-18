import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface Contractor {
  id: string;
  name: string;
  parking_number: string;
  created_at: string;
}

interface Payment {
  id: string;
  year: number;
  month: number;
  amount: number;
  paid_at: string;
}

export default function ContractorDetail() {
  const { name } = useParams<{ name: string }>();
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContractorData() {
      try {
        // 契約者情報の取得
        const { data: contractorData, error: contractorError } = await supabase
          .from("contractors")
          .select("*")
          .eq("name", decodeURIComponent(name || ""))
          .single();

        if (contractorError) {
          throw contractorError;
        }

        setContractor(contractorData);

        // 支払い履歴の取得
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("payments")
          .select("*")
          .eq("contractor_id", contractorData.id)
          .order("year", { ascending: false })
          .order("month", { ascending: false });

        if (paymentsError) {
          throw paymentsError;
        }

        setPayments(paymentsData || []);
      } catch (err) {
        console.error("Error fetching contractor data:", err);
        setError(
          err instanceof Error ? err.message : "データの取得に失敗しました"
        );
      } finally {
        setLoading(false);
      }
    }

    if (name) {
      fetchContractorData();
    }
  }, [name]);

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

  if (!contractor) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white shadow-md rounded-lg p-6">
            <p className="text-gray-500 text-center">
              契約者情報が見つかりません
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/" className="text-indigo-600 hover:text-indigo-900">
            ← 契約者一覧に戻る
          </Link>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">契約者情報</h1>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">契約者名</p>
              <p className="text-lg font-medium text-gray-900">
                {contractor.name}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">駐車スペース番号</p>
              <p className="text-lg font-medium text-gray-900">
                {contractor.parking_number}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">登録日</p>
              <p className="text-lg font-medium text-gray-900">
                {new Date(contractor.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">支払い履歴</h2>
          {payments.length === 0 ? (
            <p className="text-gray-500 text-center">支払い履歴がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      年月
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      金額
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      支払日
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      アクション
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.year}年{payment.month}月
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ¥{payment.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(payment.paid_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          onClick={() => {
                            /* PDFダウンロード処理 */
                          }}
                        >
                          <svg
                            className="mr-2 h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          PDFダウンロード
                        </button>
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
