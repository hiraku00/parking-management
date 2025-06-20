import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  getUnpaidMonths,
  getUnpaidMonthsFromData,
} from "../utils/unpaidMonths";
import { UnpaidMonthsGrid } from "../components/UnpaidMonthsGrid";
import { PaymentHistoryTable } from "../components/PaymentHistoryTable";
import { ContractorInfoGrid } from "../components/ContractorInfoGrid";


interface Contractor {
  id: string;
  name: string;
  parking_number: string;
  contract_start_year: number;
  contract_start_month: number;
  contract_end_year?: number | null;
  contract_end_month?: number | null;
  created_at: string;
}

interface Payment {
  id: string;
  year: number;
  month: number;
  amount: number;
  paid_at: string;
}

// 共通のカスタムフック
function useUnpaidMonths(contractor: Contractor | null, payments: Payment[]) {
  if (!contractor) return [];
  const paidList = payments
    .filter((p) => p.paid_at)
    .map((p) => ({ year: p.year, month: p.month }));
  return getUnpaidMonths(
    contractor.contract_start_year,
    contractor.contract_start_month,
    contractor.contract_end_year,
    contractor.contract_end_month,
    paidList
  );
}

export default function ContractorDetail() {
  const refetchContractor = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: contractorData, error: contractorError } = await supabase
        .from("contractors")
        .select("*")
        .eq("name", decodeURIComponent(name || ""))
        .single();
      if (contractorError) throw contractorError;
      setContractor(contractorData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

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

  // contractorとpaymentsが揃ったタイミングで未払いリストを算出
  const unpaidMonths = getUnpaidMonthsFromData(contractor, payments);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/" className="text-indigo-600 hover:text-indigo-900">
            ← 契約者一覧に戻る
          </Link>
        </div>

        {/* 契約者情報 */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-6">契約者情報</h1>
          <ContractorInfoGrid contractor={contractor} />
          
        </div>

        {/* 未払い年月 */}
        {contractor && <UnpaidMonthsGrid unpaidMonths={unpaidMonths} />}

        {/* 支払い履歴 */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">支払い履歴</h2>
          <PaymentHistoryTable payments={payments} />
        </div>
      </div>
    </div>
  );
}
