import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { createCheckoutSession } from "../lib/stripe-checkout";
import type { Contractor, Payment } from "@/types";
import { getUnpaidMonthsFromData } from "../utils/unpaidMonths";
import { UnpaidMonthsGrid } from "../components/UnpaidMonthsGrid";
import { PaymentHistoryTable } from "../components/PaymentHistoryTable";
import { ContractorInfoGrid } from "../components/ContractorInfoGrid";

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

  const unpaidMonths = getUnpaidMonthsFromData(contractor, payments);

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
        <div className="w-full py-8 container mx-auto px-4">
          <h1 className="text-3xl font-bold text-gray-900">
            支払い画面
          </h1>
        </div>
      </header>


      <main className="w-full container mx-auto px-4">
        {/* 契約者情報 */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-6">契約者情報</h1>
          <ContractorInfoGrid contractor={contractor} />
        </div>

        <div className="w-full">e
          {/* 支払いフォーム */}
          {/* <section className="bg-white rounded-lg shadow-sm p-6 mb-8 px-4 sm:px-8"> */}
          <section className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h1 className="text-xl font-bold text-gray-900 mb-6">
              支払い手続き
            </h1>
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
                  disabled={loading || unpaidMonths.length === 0}
                  aria-label="支払月数を選択"
                >
                  {Array.from(
                    { length: Math.max(1, unpaidMonths.length) },
                    (_, i) => i + 1
                  ).map((num) => (
                    <option key={num} value={num}>
                      {num}ヶ月
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handlePayment}
                disabled={loading || unpaidMonths.length === 0}
                className="w-full sm:w-auto bg-blue-600 text-white rounded-lg px-6 py-3 text-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={
                  unpaidMonths.length === 0
                    ? "未払いがありません"
                    : `${selectedMonths}ヶ月分を支払う`
                }
              >
                {unpaidMonths.length === 0
                  ? "未払いがありません"
                  : loading
                  ? "処理中..."
                  : `${selectedMonths}ヶ月分を支払う`}
              </button>
            </form>
          </section>

          {/* 未払い年月 */}
          {contractor && <UnpaidMonthsGrid unpaidMonths={unpaidMonths} />}

          {/* 支払い履歴 */}
          <section className="bg-white rounded-lg shadow-sm p-6 mb-8 px-4 sm:px-8">
            <h1 className="text-xl font-bold text-gray-900 mb-6">支払い履歴</h1>
            <PaymentHistoryTable payments={payments} />
          </section>
        </div>
      </main>
    </div>
  );
}
