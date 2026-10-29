// Razorpay order-creation boundary starter. Complete with current Razorpay API docs before use.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  // TODO: validate Supabase JWT; check both verified identities and advocate role.
  // TODO: allow only plan IDs from subscription_plans; fetch amount server-side.
  // TODO: use RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET stored as Edge Function secrets.
  // TODO: create Razorpay order server-side and persist its unique ID/idempotency key.
  // Never accept an arbitrary amount from the browser or activate from this response.
  return Response.json({ error: "Payment integration not enabled. Complete server-side order creation and verification first." }, { status: 501 });
});
