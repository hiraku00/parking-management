import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ContractorPage from "../ContractorPage";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import * as supabaseModule from "../../lib/supabase";
import * as stripeCheckoutModule from "../../lib/stripe-checkout";

jest.mock("../../lib/stripe-checkout");

const mockContractor = {
  id: "test-contractor-id",
  name: "テスト太郎",
  parking_number: "A-101",
  created_at: "2024-06-13T00:00:00Z",
};

const mockPayments = [
  {
    id: "pay-1",
    contractor_id: "test-contractor-id",
    year: 2024,
    month: 6,
    amount: 3500,
    paid_at: "2024-06-01T12:00:00Z",
    stripe_payment_intent_id: "pi_1",
  },
  {
    id: "pay-2",
    contractor_id: "test-contractor-id",
    year: 2024,
    month: 5,
    amount: 3500,
    paid_at: "2024-05-01T12:00:00Z",
    stripe_payment_intent_id: "pi_2",
  },
];

function renderWithRouter(name: string) {
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/contractor/:name" element={<ContractorPage />} />
      </Routes>
    </BrowserRouter>,
    { wrapper: ({ children }) => <>{children}</> }
  );
}

describe("ContractorPage UI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(supabaseModule.supabase, "from")
      .mockImplementation((table: string) => {
        if (table === "contractors") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: mockContractor, error: null }),
              }),
            }),
          } as any;
        }
        if (table === "payments") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  order: async () => ({ data: mockPayments, error: null }),
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });
  });

  it("契約者名・駐車場番号・支払い状況・履歴が表示される", async () => {
    window.history.pushState({}, "", "/contractor/テスト太郎");
    renderWithRouter("テスト太郎");

    // ヘッダー
    expect(await screen.findByText("テスト太郎様")).toBeInTheDocument();
    expect(screen.getByText(/駐車場番号: A-101/)).toBeInTheDocument();

    // 支払い状況（支払済/未払い）
    expect(screen.getByText(/支払い状況/)).toBeInTheDocument();
    expect(screen.getByText(/支払い/)).toBeInTheDocument();
    expect(screen.getByText(/支払い履歴/)).toBeInTheDocument();

    // 履歴テーブル
    expect(screen.getByText("2024年6月")).toBeInTheDocument();
    expect(screen.getByText("2024年5月")).toBeInTheDocument();
    expect(screen.getAllByText("¥3,500").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("2024/6/1")).toBeInTheDocument();
    expect(screen.getByText("2024/5/1")).toBeInTheDocument();
    expect(screen.getAllByText("ダウンロード").length).toBeGreaterThanOrEqual(
      2
    );
  });

  it("支払月数を選択し、支払いボタンが押せる", async () => {
    window.history.pushState({}, "", "/contractor/テスト太郎");
    renderWithRouter("テスト太郎");
    await waitFor(() => screen.getByText("テスト太郎様"));

    const select = screen.getByLabelText("支払月数を選択") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "3" } });
    expect(select.value).toBe("3");

    const payButton = screen.getByRole("button", { name: /3ヶ月分を支払う/ });
    expect(payButton).toBeEnabled();

    // 支払い処理のモック
    (stripeCheckoutModule.createCheckoutSession as jest.Mock).mockResolvedValue(
      undefined
    );
    fireEvent.click(payButton);
    await waitFor(() => {
      expect(stripeCheckoutModule.createCheckoutSession).toHaveBeenCalledWith(
        "test-contractor-id",
        3
      );
    });
  });

  it("エラー時はエラーメッセージが表示される", async () => {
    // supabaseのcontractors取得でエラーを返す
    (supabaseModule.supabase.from as jest.Mock).mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: new Error("DB error") }),
        }),
      }),
    }));
    window.history.pushState({}, "", "/contractor/テスト太郎");
    renderWithRouter("テスト太郎");
    expect(await screen.findByText(/エラーが発生しました/)).toBeInTheDocument();
    expect(
      screen.getByText(/契約者情報の取得に失敗しました/)
    ).toBeInTheDocument();
  });
});
