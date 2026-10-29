# Supabase Edge Functions

These are starter templates. They are not deployed automatically by running the frontend.

## legal-chat
Deploy `legal-chat` and set provider credentials as Supabase function secrets, never as VITE variables. The included template is intentionally conservative: it provides official starting points and does not invent case-specific citations. Replace it only with a retrieval-backed implementation that uses current official Indian legal sources and returns verifiable source URLs.

## payment-create-order
The Razorpay template shows the required server-side boundary. Complete the order API call, signature validation and persistent state transition using current Razorpay documentation before enabling it.

## payment-webhook
Complete raw-body webhook signature verification, event allowlisting, idempotent database updates and subscription activation only after a verified payment. Do not rely on client-side redirects.

## deploy
Use the Supabase CLI and current Supabase documentation. Set secrets with the Supabase dashboard or CLI secrets command. Do not commit `.env`, API keys or service-role keys.
