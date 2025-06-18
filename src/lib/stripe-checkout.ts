import { stripePromise } from "./stripe";
import { supabase } from "./supabase";

export async function createCheckoutSession(
  contractorId: string,
  months: number
) {
  try {
    console.log("Creating checkout session for contractor:", contractorId, "months:", months);

    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
      body: { contractorId, months },
    });

    console.log("Supabase function response:", { data, error });

    if (error) {
      console.error("Supabase function error:", error);
      throw new Error(error.message);
    }

    if (!data || !data.sessionId) {
      console.error("Invalid response data:", data);
      throw new Error("No session ID returned from server");
    }

    const stripe = await stripePromise;
    if (!stripe) {
      throw new Error("Stripe is not initialized");
    }

    console.log("Redirecting to Stripe checkout with session ID:", data.sessionId);

    const { error: redirectError } = await stripe.redirectToCheckout({
      sessionId: data.sessionId,
    });

    if (redirectError) {
      console.error("Stripe redirect error:", redirectError);
      throw redirectError;
    }

    return { success: true };
  } catch (error) {
    console.error("Checkout session creation error:", error);
    throw error;
  }
}
