# NayayaMitra — editable full-stack starter

NayayaMitra is a starter project for an India-focused legal information platform. It includes a React + TypeScript frontend, Supabase authentication/database setup, SQL tables and row-level security (RLS), and Edge Function starter files for AI chat and payment workflows.

**Important:** this is a scaffold for a college project, not a certified legal service or production-ready payment system. You must configure credentials, verify current legal sources, test every security rule, and obtain qualified review before real users or payments. Demo mode is enabled when Supabase environment variables are absent; it does not create real accounts, payments, or verified advocate listings.

## Stack
- React, TypeScript, Vite, React Router
- Supabase Auth + PostgreSQL + Storage + Edge Functions
- Razorpay-ready server-side payment function outline
- UPI manual verification workflow outline

## Run locally
1. Install Node.js LTS (18+; 20+ recommended).
2. Extract this ZIP and open a terminal in the project folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local`.
5. Fill in your Supabase project URL and anon/public key, if you have created a Supabase project.
6. Run `npm run dev` and open the local URL shown in the terminal.
7. Run `npm run build` to check the production build.

With no Supabase values, the site shows a local demo UI. Demo login is not secure authentication and must not be used as real access control.

## Supabase setup
1. Create a project at https://supabase.com.
2. In the Supabase SQL Editor, run `supabase/migrations/001_initial_schema.sql`.
3. In Authentication settings, configure Google OAuth and phone/SMS OTP providers. Follow Supabase's current instructions for Google OAuth redirect URLs and an SMS provider.
4. Configure redirect URLs for local development and your deployed domain.
5. Create private Storage buckets `advocate-documents` and `payment-proofs`. Keep them private; access should be granted only through policies or short-lived signed URLs.
6. Deploy Edge Functions in `supabase/functions/` and configure function secrets in the Supabase dashboard/CLI. See `supabase/functions/README.md`.
7. Configure production policies, email/SMS provider limits, rate limits, backups, monitoring, and audit logging before launch.

The frontend includes a Google sign-in entry point and phone OTP controls. A real deployment must enforce that **both** Google identity and phone verification are completed before protected actions. Do not rely on client-side checks alone. Enforce it in Edge Functions/database policies as described in `supabase/SECURITY_CHECKLIST.md`.

## Legal information safeguards
- This app provides general information, not legal advice or lawyer-client representation.
- The sample chatbot refuses to invent case citations and directs users to official sources.
- Replace any placeholder legal content with reviewed material from official Indian sources, such as India Code (`https://www.indiacode.nic.in/`), Supreme Court of India (`https://www.sci.gov.in/`), eCourts (`https://ecourts.gov.in/`), and NALSA (`https://nalsa.gov.in/`).
- Do not claim that any advocate, credential, contact detail, or legal-aid service is verified until it has actually been checked against a trustworthy source.
- The directory starts empty by design; add only real, properly sourced records.

## Subscription/payment workflow
Configured plan labels:
- 1 month: ₹500
- 6 months: ₹2,499

These are display prices only until a backend payment integration is configured. The frontend does not activate subscriptions from a client-side success message. For Razorpay, create orders on the server, verify payment signatures and webhook signatures, make processing idempotent, and activate only after server-side verification. For UPI manual review, store the UTR/reference and optional proof privately; admin must reconcile with the actual bank/UPI statement before approval. Never paste secrets into frontend files.

## Source layout
```
src/
  components/       Reusable layout and auth gate
  lib/              Supabase client and API helpers
  pages/            Home, auth, dashboard, chat, directory, advocate, admin, policies
  styles.css        Responsive design system
supabase/
  migrations/       Database schema and RLS
  functions/        Edge Function starter templates
```

## GitHub and deployment
- Create a private GitHub repository, then run:
  `git init`, `git add .`, `git commit -m "Initial NayayaMitra source"`,
  `git branch -M main`, `git remote add origin YOUR_REPOSITORY_URL`, `git push -u origin main`.
- Do not commit `.env.local` or secrets.
- Deploy the frontend using a host that supports Vite (e.g. Vercel, Netlify, or Cloudflare Pages). Set the two `VITE_SUPABASE_*` public variables in its environment settings.
- Configure Supabase functions, OAuth redirect URLs, allowed origins, and storage policies for the production domain.

## Known next steps before calling this complete
- Finish server-enforced dual verification (Google + phone OTP) and test bypass attempts.
- Add verified advocate records only after research and consent.
- Implement admin identity provisioning securely (never let users self-select admin).
- Complete Razorpay order creation, signature verification, webhook idempotency, refunds and reconciliation.
- Complete UPI proof review and private signed-file access.
- Add reviewed legal knowledge retrieval, citations, language-specific evaluation and safety tests.
- Add automated tests, accessibility review, security review, backups and monitoring.

## Owner-provided UPI QR (updated UI)
The plans page now displays the QR image supplied by the site owner and the UPI ID shown in that image. The plan selector updates the displayed amount. **This is UI only**: UTR submissions, server-side admin verification, subscription activation, phone OTP, email verification, and live AI/payment integrations are not completed by this change. Configure and test those server-side features before collecting real payments or launching publicly. The QR image is stored at `public/owner-upi-qr.jpg`.

## Updated payment, admin, and AI work (2026-10-11)

This ZIP includes the supplied owner UPI QR at `public/owner-upi-qr.jpg`, a UPI reference submission form, an owner-role checked payment review screen, a database RPC for approve/reject decisions, email magic-link sign-in UI, a case-draft route, and an OpenAI-backed legal-chat Edge Function.

### Required before real use

1. Create a Supabase project and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
2. Apply migrations in order: `001_initial_schema.sql`, `002_admin_payment_review.sql`, `003_email_phone_verification.sql` using the Supabase SQL editor. Review SQL against your Supabase project before applying.
3. In Supabase Auth, enable email confirmations and configure an SMS provider and phone verification. Configure redirect URLs for your deployed domain. Email magic links and phone OTP are separate verification mechanisms; link both identities to the same user before treating the account as dual verified. The database policy rejects payment submissions unless both verified identities exist on that user.
4. Sign in as the owner, obtain the owner's actual Supabase Auth UUID, and assign the admin role using the SQL editor: `update public.profiles set role = 'admin' where id = 'OWNER_AUTH_USER_UUID';`. Never expose this operation in the public frontend.
5. Set `OPENAI_API_KEY` as a Supabase Edge Function secret, optionally set `OPENAI_MODEL`, and deploy `legal-chat`. The function provides general model-generated information and official starting-point links; it is not a legal-source retrieval engine and does not guarantee that each link was consulted for a given answer.
6. Deploy functions with the Supabase CLI. Keep provider keys server-side only. Run through Supabase's local/staging environment first.
7. For UPI, verify each UTR against the receiving account statement before using the admin RPC. A QR, screenshot, or user-submitted reference is not payment proof. Gateway payments remain unavailable until order creation and signed webhook verification are configured.

### Verification status

The code was updated, but a dependency install/build could not be completed in this environment because `npm install` timed out. Therefore this archive is **not represented as production-ready or fully tested**. Live email/phone OTP, OpenAI, Supabase RLS, UPI reconciliation, and admin approval must be tested in your own configured staging project before launch. The advocate directory intentionally does not invent 36 verified contacts; only publish advocates whose public professional details and enrollment status have been independently checked.

## Advocate dashboard layout update

The AI Case Draft is now an in-dashboard section at `/advocate/dashboard`, not intended as a standalone page. The legacy `/case-draft` path redirects to the advocate dashboard. The dashboard currently provides Overview, AI Case Draft, My Cases, and My Profile sections. My Cases/Profile persistence and server-side advocate-role enforcement still require backend implementation/configuration; do not treat the current UI guard as production authorization.
