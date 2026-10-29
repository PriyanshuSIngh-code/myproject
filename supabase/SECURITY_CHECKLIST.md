# Security checklist — complete before real deployment

## Authentication and authorization
- [ ] Configure Google OAuth and phone OTP provider in Supabase Auth.
- [ ] Implement a trusted server-side flow that proves both Google identity and phone verification.
- [ ] Populate `google_verified_at` only after verified OAuth identity; populate `phone_verified_at` only after Supabase/server validation.
- [ ] Do not trust user-editable metadata, localStorage, route guards or client-supplied role values.
- [ ] Protect every privileged Edge Function by validating JWT and checking role in the database.
- [ ] Provision admin role manually using a secure trusted process; never add public admin registration.
- [ ] Test RLS using anon, user A, user B, advocate and admin accounts.

## Storage
- [ ] Create private `advocate-documents` and `payment-proofs` buckets.
- [ ] Restrict upload paths to the authenticated user's own UUID prefix.
- [ ] Restrict document reads to owner and authorized admin reviewers.
- [ ] Validate MIME type and size server-side; malware-scan where available.
- [ ] Issue short-lived signed URLs only after authorization. Do not log document URLs.
- [ ] Define document retention, deletion and incident response processes.

## Payments
- [ ] Create gateway orders only on the server.
- [ ] Verify payment signature server-side; verify webhook signature using raw request body.
- [ ] Use idempotency and unique gateway order/payment IDs.
- [ ] Never activate subscriptions based on a browser redirect alone.
- [ ] For UPI, reconcile UTR/reference against the real merchant account statement.
- [ ] Only activate after documents approved AND payment verified.
- [ ] Never place secrets in `VITE_*` variables or frontend bundles.

## AI/legal safety
- [ ] Retrieve current legal text from official Indian sources and retain source URLs.
- [ ] Do not fabricate statutes, case names, citations, lawyer details or official contacts.
- [ ] Add prompt-injection defenses, rate limits, abuse controls and privacy-conscious logging.
- [ ] Evaluate outputs in supported languages, including refusals and citation correctness.
- [ ] Display the legal disclaimer near all generated legal information.
