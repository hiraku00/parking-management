import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let retryCount = 0;
    const checkPaymentStatus = async () => {
      if (!sessionId) {
        setError("セッションIDが見つかりません");
        setIsLoading(false);
        return;
      }

      try {
        // 支払い情報を複数件取得
        const { data: payments, error } = await supabase
          .from("payments")
          .select("*, contractors(name)")
          .eq("stripe_session_id", sessionId);

        if (error || !payments || payments.length === 0) {
          // 3回までリトライ
          if (retryCount < 3) {
            retryCount++;
            setTimeout(checkPaymentStatus, 1000);
            return;
          }
          throw new Error("支払い情報の取得に失敗しました");
        }

        // 最初のレコードを利用
        const payment = payments[0];

        // paid_atの有無で判定
        if (!payment.paid_at) {
          navigate(
            `/contractor/${encodeURIComponent(
              payment.contractors.name
            )}/payment`
          );
          return;
        }

        // 支払いが完了している場合は、3秒後に支払いページにリダイレクト
        setTimeout(() => {
          navigate(
            `/contractor/${encodeURIComponent(
              payment.contractors.name
            )}/payment`
          );
        }, 3000);

        setIsLoading(false);
      } catch (err) {
        console.error("Error:", err);
        setError(err instanceof Error ? err.message : "エラーが発生しました");
        setIsLoading(false);
      }
    };

    checkPaymentStatus();
  }, [sessionId, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-center text-gray-600 mb-4">
            支払い情報を確認中...
          </h1>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h1 className="text-2xl font-bold text-center text-red-600 mb-4">
            決済が完了していません
          </h1>
          <p className="text-center text-gray-600 mb-4">
            決済が完了していません。決済完了後に自動でページが切り替わります。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-center text-green-600 mb-4">
          支払いが完了しました
        </h1>
        <p className="text-center text-gray-600 mb-4">
          支払いページに移動します...
        </p>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      </div>
    </div>
  );
}
