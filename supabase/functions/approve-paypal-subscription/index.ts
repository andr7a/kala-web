import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const paypalClientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const paypalClientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
    
    if (!paypalClientId || !paypalClientSecret) {
      throw new Error("PayPal configuration missing");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    const { userId, subscriptionId } = await req.json();

    if (!userId || !subscriptionId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authResponse = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${paypalClientId}:${paypalClientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!authResponse.ok) {
      throw new Error("Failed to authenticate with PayPal");
    }

    const { access_token } = await authResponse.json();

    const subscriptionResponse = await fetch(
      `https://api-m.paypal.com/v1/billing/subscriptions/${subscriptionId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!subscriptionResponse.ok) {
      throw new Error("Failed to verify PayPal subscription");
    }

    const subscription = await subscriptionResponse.json();

    if (subscription.status !== "ACTIVE") {
      return new Response(
        JSON.stringify({ error: "Subscription is not active" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const startDate = new Date(subscription.start_time);
    const billingInfo = subscription.billing_info;
    const nextBillingTime = billingInfo?.next_billing_time 
      ? new Date(billingInfo.next_billing_time)
      : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    await supabase
      .from("user_profiles")
      .update({
        subscription_status: "active",
        subscription_tier: "premium",
        paypal_subscription_id: subscriptionId,
        subscription_start_date: startDate.toISOString(),
        subscription_end_date: nextBillingTime.toISOString(),
      })
      .eq("id", userId);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error approving PayPal subscription:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});