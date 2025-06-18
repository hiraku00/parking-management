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
    const checkPaymentStatus = async () => {
      if (!sessionId) {
        setError("セッションIDが見つかりません");
        setIsLoading(false);
        return;
      }

      try {
        // 支払い情報を取得
        const { data: payment, error } = await supabase
          .from("payments")
          .select("*, contractors(name)")
          .eq("stripe_session_id", sessionId)
          .single();

        if (error || !payment) {
          throw new Error("支払い情報の取得に失敗しました");
        }

        // 支払いが完了していない場合は、支払いページにリダイレクト
        if (payment.status !== "completed") {
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
            エラーが発生しました
          </h1>
          <p className="text-center text-gray-600 mb-4">{error}</p>
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
