// Webhook starter. Do not enable until raw-body signature verification is implemented.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawBody = await req.text();
  // TODO: verify Razorpay webhook signature over rawBody using RAZORPAY_WEBHOOK_SECRET.
  // TODO: reject invalid signatures; allowlist event types; ensure event/payment IDs are idempotent.
  // TODO: reconcile amount, currency, order and user; update payment inside a transaction.
  // TODO: activate subscription only if credential review is also approved.
  void rawBody;
  return Response.json({ error: "Webhook not enabled: signature verification and idempotent persistence are required." }, { status: 501 });
});
