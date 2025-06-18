import { createCheckoutSession } from "../stripe-checkout";
import { supabase } from "../supabase";
import { stripePromise } from "../stripe";

// Mock the supabase and stripe modules
jest.mock("../supabase", () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock("../stripe", () => ({
  stripePromise: Promise.resolve({
    redirectToCheckout: jest.fn(),
  }),
}));

describe("Stripe Checkout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully create a checkout session", async () => {
    // Mock successful response from Supabase
    const mockSessionId = "test_session_id";
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { sessionId: mockSessionId },
      error: null,
    });

    // Mock successful redirect
    const mockStripe = await stripePromise;
    (mockStripe.redirectToCheckout as jest.Mock).mockResolvedValue({
      error: null,
    });

    await createCheckoutSession("test_contractor_id", 1);

    // Verify Supabase function was called with correct parameters
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      "create-checkout-session",
      {
        body: { contractorId: "test_contractor_id", months: 1 },
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Verify Stripe redirect was called with correct session ID
    expect(mockStripe.redirectToCheckout).toHaveBeenCalledWith({
      sessionId: mockSessionId,
    });
  });

  it("should handle Supabase function error", async () => {
    // Mock Supabase function error
    const mockError = new Error("Supabase function error");
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: null,
      error: mockError,
    });

    await expect(createCheckoutSession("test_contractor_id", 1)).rejects.toThrow(
      "支払いセッションの作成に失敗しました: Supabase function error"
    );
  });

  it("should handle invalid response data", async () => {
    // Mock invalid response data
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { invalid: "data" },
      error: null,
    });

    await expect(createCheckoutSession("test_contractor_id", 1)).rejects.toThrow(
      "支払いセッションの作成に失敗しました: 無効なレスポンス"
    );
  });

  it("should handle Stripe redirect error", async () => {
    // Mock successful Supabase response
    const mockSessionId = "test_session_id";
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({
      data: { sessionId: mockSessionId },
      error: null,
    });

    // Mock Stripe redirect error
    const mockStripe = await stripePromise;
    (mockStripe.redirectToCheckout as jest.Mock).mockResolvedValue({
      error: new Error("Stripe redirect error"),
    });

    await expect(createCheckoutSession("test_contractor_id", 1)).rejects.toThrow(
      "支払いページへのリダイレクトに失敗しました: Stripe redirect error"
    );
  });
});
