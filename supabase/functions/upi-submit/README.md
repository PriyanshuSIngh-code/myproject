# UPI manual verification workflow

The intended workflow is:
1. Advocate chooses an enabled plan. The server creates a pending payment record with the authoritative amount.
2. The owner supplies their own UPI QR details through a secure configuration process; never hardcode personal payment details in the repository.
3. Applicant submits UTR/reference and optional proof into the private `payment-proofs` bucket.
4. An authorized admin reconciles the transaction with the actual merchant bank/UPI statement and records the decision.
5. Subscription is activated only if the credential application is approved and the payment is verified.

A browser screenshot or user-entered UTR is not proof of successful payment by itself. Build admin review as a server-checked workflow and audit all decisions.
