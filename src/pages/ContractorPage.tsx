import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { createCheckoutSession } from "../lib/stripe-checkout";
import type { Contractor, Payment } from "@/types";

export default function ContractorPage() {
  const { name } = useParams<{ name: string }>();
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchContractor();
  }, [name]);

  useEffect(() => {
    if (contractor) {
      fetchPayments();
    }
  }, [contractor]);

  const fetchContractor = async () => {
    try {
      const { data, error } = await supabase
        .from("contractors")
        .select("*")
        .eq("name", name)
        .single();

      if (error) throw error;
      setContractor(data);
    } catch (error) {
      console.error("Error fetching contractor:", error);
      setError("契約者情報の取得に失敗しました");
    }
  };

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("contractor_id", contractor?.id)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error("Error fetching payments:", error);
      setError("支払い履歴の取得に失敗しました");
    }
  };

  const handlePayment = async () => {
    if (!contractor) return;
    setLoading(true);
    setError(null);

    try {
      await createCheckoutSession(contractor.id, selectedMonths);
    } catch (error) {
      console.error("Payment error:", error);
      setError("支払い処理に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (payment: Payment) => {
    // PDFダウンロード処理
    console.log("Download PDF for payment:", payment);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 w-full flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
          <h2 className="text-xl font-semibold text-red-600 mb-4">
            エラーが発生しました
          </h2>
          <p className="text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="min-h-screen bg-gray-50 w-full flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            読み込み中...
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      {/* ヘッダー */}
      <header className="w-full bg-white border-b border-gray-200 mb-8">
        <div className="w-full py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {contractor.name}様
          </h1>
          <p className="text-gray-600">
            駐車場番号: {contractor.parking_number}
          </p>
        </div>
      </header>

      <main className="w-full">
        <div className="w-full">
          {/* 支払い状況 */}
          <section className="bg-white rounded-lg shadow-sm p-6 mb-8 px-4 sm:px-8">
            <h2 className="text-xl font-semibold mb-4">支払い状況</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 6 }, (_, i) => {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const payment = payments.find(
                  (p) => p.year === year && p.month === month
                );
                return (
                  <div
                    key={`${year}-${month}`}
                    className={`rounded-lg border text-center py-4 px-2 text-base font-medium
                      ${
                        payment
                          ? "bg-green-50 border-green-200 text-green-700"
                          : "bg-yellow-50 border-yellow-200 text-yellow-700"
                      }
                    `}
                  >
                    <div>
                      {year}年{month}月
                    </div>
                    <div className="mt-1 text-sm font-bold">
                      {payment ? "支払済" : "未払い"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 支払いフォーム */}
          <section className="bg-white rounded-lg shadow-sm p-6 mb-8 px-4 sm:px-8">
            <h2 className="text-xl font-semibold mb-4">支払い</h2>
            <form className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-auto">
                <label
                  htmlFor="months"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  支払月数
                </label>
                <select
                  id="months"
                  value={selectedMonths}
                  onChange={(e) => setSelectedMonths(Number(e.target.value))}
                  className="w-full sm:w-40 border-gray-300 rounded-lg bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-500 px-3 py-2"
                  disabled={loading}
                  aria-label="支払月数を選択"
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      {num}ヶ月
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handlePayment}
                disabled={loading}
                className="w-full sm:w-auto bg-blue-600 text-white rounded-lg px-6 py-3 text-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`${selectedMonths}ヶ月分を支払う`}
              >
                {loading ? "処理中..." : `${selectedMonths}ヶ月分を支払う`}
              </button>
            </form>
          </section>

          {/* 支払い履歴 */}
          <section className="bg-white rounded-lg shadow-sm p-6 mb-8 px-4 sm:px-8">
            <h2 className="text-xl font-semibold mb-4">支払い履歴</h2>
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
                        {payment.paid_at
                          ? new Date(payment.paid_at).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {payment.paid_at && (
                          <button
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            onClick={() => handleDownloadPDF(payment)}
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
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
