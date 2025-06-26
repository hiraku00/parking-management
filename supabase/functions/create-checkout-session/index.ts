import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@13.11.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};

// デバッグログ用の関数
const debugLog = (message: string, data?: any) => {
  console.log(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : "");
};

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
debugLog("Stripe Secret Key exists:", !!stripeSecretKey);
debugLog("All environment variables:", {
  FRONTEND_URL: Deno.env.get("FRONTEND_URL"),
  STRIPE_SECRET_KEY: Deno.env.get("STRIPE_SECRET_KEY") ? "exists" : "missing",
  SUPABASE_URL: Deno.env.get("SUPABASE_URL") ? "exists" : "missing",
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ? "exists"
    : "missing",
});

if (!stripeSecretKey) {
  throw new Error("Missing Stripe secret key");
}
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-05-28.basil",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    debugLog("Request body:", body);
    const { contractorId, months } = JSON.parse(body);

    if (!contractorId || !months) {
      throw new Error("Missing required parameters");
    }

    // 契約者情報の取得（月額料金も含めて取得）
    const { data: contractor, error: contractorError } = await supabaseClient
      .from("contractors")
      .select("name, parking_number, monthly_fee")
      .eq("id", contractorId)
      .single();

    debugLog("Contractor data:", { contractor, error: contractorError });

    if (contractorError) {
      throw new Error("Contractor not found");
    }
    if (!contractor) {
      throw new Error("Contractor not found");
    }

    // 金額は契約者ごとの月額料金を使用（必須項目なのでデフォルト不要）
    const monthlyFee = contractor.monthly_fee;
    const amount = monthlyFee * months;
    debugLog("Payment amount:", { monthlyFee, months, amount });

    const frontendUrl = Deno.env.get("FRONTEND_URL");
    debugLog("FRONTEND_URL:", frontendUrl);

    if (!frontendUrl) {
      throw new Error("FRONTEND_URL is not set");
    }

    const encodedName = encodeURIComponent(contractor.name);
    const successUrl = `${frontendUrl}/contractor/${encodedName}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontendUrl}/contractor/${encodedName}`;

    debugLog("URLs:", { successUrl, cancelUrl });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              name: `駐車場利用料 ${months}ヶ月分`,
              description: `駐車場番号: ${contractor.parking_number}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        contractor_id: contractorId,
        months: months.toString(),
      },
    });

    debugLog("Stripe session created:", { sessionId: session.id });

    return new Response(
      JSON.stringify({
        sessionId: session.id,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      },
    );
  } catch (error) {
    debugLog("Error occurred:", { message: error.message, stack: error.stack });
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 400,
      },
    );
  }
});
