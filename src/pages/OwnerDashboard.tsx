import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getUnpaidMonthsFromData } from "../utils/unpaidMonths";
import ContractorCreateForm from "../components/ContractorCreateForm";
import {
  updateContractorMonthlyFee,
  updateContractorInfo,
  deleteContractor,
} from "../services/contractorService";

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

  // 編集用状態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    name: string;
    parking_number: string;
    contract_start_year: number;
    contract_start_month: number;
    contract_end_year: number | null;
    contract_end_month: number | null;
    monthly_fee: number | null;
  }>({
    name: "",
    parking_number: "",
    contract_start_year: new Date().getFullYear(),
    contract_start_month: 1,
    contract_end_year: null,
    contract_end_month: null,
    monthly_fee: null,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 削除用状態
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const navigate = useNavigate();

  // 編集開始
  const handleEditClick = (contractor: Contractor) => {
    setEditingId(contractor.id);
    setEditValues({
      name: contractor.name,
      parking_number: contractor.parking_number,
      contract_start_year: contractor.contract_start_year,
      contract_start_month: contractor.contract_start_month,
      contract_end_year: contractor.contract_end_year ?? null,
      contract_end_month: contractor.contract_end_month ?? null,
      monthly_fee: (contractor as any).monthly_fee ?? null,
    });
    setEditError(null);
  };

  // 編集保存
  const handleSaveEdit = async () => {
    if (!editingId) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const {
        name,
        parking_number,
        contract_start_year,
        contract_start_month,
        contract_end_year,
        contract_end_month,
        monthly_fee,
      } = editValues;
      // バリデーション: 駐車場番号は数字のみ
      if (!/^[0-9]+$/.test(String(parking_number))) {
        setEditError("駐車場番号は数字のみ入力してください");
        setEditLoading(false);
        return;
      }
      // バリデーション: 駐車場番号の重複チェック（自分以外で同じ番号が存在しないか）
      const duplicate = contractors.some(
        (c) =>
          c.id !== editingId &&
          String(c.parking_number) === String(parking_number) &&
          // 契約終了年月が未設定(null)または未来（現役契約）
          (c.contract_end_year == null ||
            c.contract_end_year > contract_start_year ||
            (c.contract_end_year === contract_start_year &&
              (c.contract_end_month == null ||
                c.contract_end_month >= contract_start_month)))
      );
      if (duplicate) {
        setEditError("同じ駐車場番号で現役契約が既に存在します");
        setEditLoading(false);
        return;
      }
      // 月額料金50円未満はエラー
      if (
        monthly_fee === null ||
        monthly_fee === undefined ||
        monthly_fee < 50
      ) {
        setEditError("月額料金は50円以上で入力してください");
        setEditLoading(false);
        return;
      }
      await updateContractorInfo(editingId, {
        name,
        parking_number,
        contract_start_year,
        contract_start_month,
        contract_end_year,
        contract_end_month,
        monthly_fee,
      });
      setEditingId(null);
      await fetchContractors();
    } catch (err: any) {
      setEditError(err.message || "更新に失敗しました");
    } finally {
      setEditLoading(false);
    }
  };

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
                      月額料金
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
                  {contractors.map((contractor) =>
                    editingId === contractor.id ? (
                      <tr
                        key={contractor.id}
                        className="hover:bg-gray-50 bg-yellow-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <input
                            className="border rounded px-2 py-1 w- bg-white"
                            value={editValues.name}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                name: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="border rounded px-2 py-1 w-16 bg-white"
                            value={editValues.parking_number}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                parking_number: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-20 mr-1 bg-gray-100 text-gray-500"
                            value={editValues.contract_start_year}
                            min={2000}
                            max={2100}
                            disabled
                          />
                          年
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-14 ml-1 bg-gray-100 text-gray-500"
                            value={editValues.contract_start_month}
                            min={1}
                            max={12}
                            disabled
                          />
                          月
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-20 mr-1 bg-white"
                            value={editValues.contract_end_year ?? ""}
                            min={2000}
                            max={2100}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                contract_end_year: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              }))
                            }
                          />
                          年
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-14 ml-1 bg-white"
                            value={editValues.contract_end_month ?? ""}
                            min={1}
                            max={12}
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                contract_end_month:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              }))
                            }
                          />
                          月
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <input
                            type="text"
                            className="border rounded px-2 py-1 w-24 bg-white"
                            value={editValues.monthly_fee ?? ""}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            onChange={(e) =>
                              setEditValues((v) => ({
                                ...v,
                                monthly_fee: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              }))
                            }
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          -
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            className="bg-blue-600 text-white px-2 py-1 rounded mr-2"
                            onClick={handleSaveEdit}
                            disabled={editLoading}
                          >
                            保存
                          </button>
                          <button
                            className="bg-gray-400 text-white px-2 py-1 rounded"
                            onClick={() => setEditingId(null)}
                            disabled={editLoading}
                          >
                            キャンセル
                          </button>
                          {editError && (
                            <div className="text-xs text-red-600 mt-1">
                              {editError}
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
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
                          {contractor.monthly_fee
                            ? `¥${contractor.monthly_fee.toLocaleString()}`
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {getUnpaidMonthsFromData(
                            contractor,
                            contractor.payments ?? []
                          ).length > 0 ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              未払い
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              支払済
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            className="bg-green-500 text-white px-2 py-1 rounded mr-2"
                            onClick={() =>
                              navigate(
                                `/contractor/${encodeURIComponent(
                              contractor.name
                                )}`
                              )
                            }
                          >
                            詳細
                          </button>
                          <button
                            className="bg-yellow-500 text-white px-2 py-1 rounded mr-2"
                            onClick={() => handleEditClick(contractor)}
                          >
                            編集
                          </button>
                          <button
                            className="bg-red-600 text-white px-2 py-1 rounded mr-2"
                            onClick={async () => {
                              if (window.confirm("本当に削除しますか？")) {
                                setDeleteLoading(contractor.id);
                                setDeleteError(null);
                                try {
                                  await deleteContractor(contractor.id);
                                  await fetchContractors();
                                } catch (err: any) {
                                  setDeleteError(
                                    err.message || "削除に失敗しました"
                                  );
                                } finally {
                                  setDeleteLoading(null);
                                }
                              }
                            }}
                            disabled={deleteLoading === contractor.id}
                          >
                            {deleteLoading === contractor.id
                              ? "削除中..."
                              : "削除"}
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
