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
    const paypalWebhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
    
    if (!paypalClientId || !paypalClientSecret) {
      throw new Error("PayPal configuration missing");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    const body = await req.text();
    const event = JSON.parse(body);

    if (paypalWebhookId) {
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

      const verifyResponse = await fetch(
        "https://api-m.paypal.com/v1/notifications/verify-webhook-signature",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transmission_id: req.headers.get("paypal-transmission-id"),
            transmission_time: req.headers.get("paypal-transmission-time"),
            cert_url: req.headers.get("paypal-cert-url"),
            auth_algo: req.headers.get("paypal-auth-algo"),
            transmission_sig: req.headers.get("paypal-transmission-sig"),
            webhook_id: paypalWebhookId,
            webhook_event: event,
          }),
        }
      );

      if (!verifyResponse.ok) {
        throw new Error("Webhook verification failed");
      }

      const verifyResult = await verifyResponse.json();
      if (verifyResult.verification_status !== "SUCCESS") {
        throw new Error("Invalid webhook signature");
      }
    }

    const eventType = event.event_type;
    const resource = event.resource;

    switch (eventType) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "BILLING.SUBSCRIPTION.UPDATED": {
        const userId = resource.custom_id;
        const subscriptionId = resource.id;
        const status = resource.status;

        if (userId) {
          const startDate = new Date(resource.start_time || resource.create_time);
          const billingInfo = resource.billing_info;
          const nextBillingTime = billingInfo?.next_billing_time
            ? new Date(billingInfo.next_billing_time)
            : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

          await supabase
            .from("user_profiles")
            .update({
              subscription_status: status === "ACTIVE" ? "active" : "cancelled",
              subscription_tier: status === "ACTIVE" ? "premium" : "free",
              paypal_subscription_id: subscriptionId,
              subscription_start_date: startDate.toISOString(),
              subscription_end_date: nextBillingTime.toISOString(),
            })
            .eq("id", userId);
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.SUSPENDED":
      case "BILLING.SUBSCRIPTION.EXPIRED": {
        const userId = resource.custom_id;

        if (userId) {
          await supabase
            .from("user_profiles")
            .update({
              subscription_status: "cancelled",
              subscription_tier: "free",
            })
            .eq("id", userId);
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED": {
        const userId = resource.custom_id;

        if (userId) {
          await supabase
            .from("user_profiles")
            .update({
              subscription_status: "past_due",
            })
            .eq("id", userId);
        }
        break;
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});