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
    const paypalPlanId = Deno.env.get("PAYPAL_PLAN_ID");
    
    if (!paypalClientId || !paypalClientSecret || !paypalPlanId) {
      throw new Error("PayPal configuration missing");
    }

    const { userId, email } = await req.json();

    if (!userId || !email) {
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

    const subscriptionResponse = await fetch("https://api-m.paypal.com/v1/billing/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: paypalPlanId,
        subscriber: {
          email_address: email,
        },
        application_context: {
          user_action: "SUBSCRIBE_NOW",
          return_url: `${req.headers.get("origin") || "http://localhost:5173"}/cars?success=true`,
          cancel_url: `${req.headers.get("origin") || "http://localhost:5173"}/pricing?canceled=true`,
        },
        custom_id: userId,
      }),
    });

    if (!subscriptionResponse.ok) {
      const errorData = await subscriptionResponse.text();
      console.error("PayPal subscription error:", errorData);
      throw new Error("Failed to create PayPal subscription");
    }

    const subscription = await subscriptionResponse.json();

    return new Response(
      JSON.stringify({ subscriptionId: subscription.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating PayPal subscription:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});