# Payment flow (UPI collect + manual verification)

VATTAMS ACADEMIA does not use a payment gateway in this phase — it uses a
UPI collect + manual UTR verification flow, per spec.

## Flow

1. Student opens a paid course and clicks **Enrol and pay**.
2. `Payment.tsx` reads the course's `base_fee` / `discount_amount` **live
   from the database** — the amount is never hardcoded in a component.
   A `payments` row is created with `status = 'pending'`.
3. The page renders a UPI deep link (`upi://pay?...`) as both a QR code
   and a tappable button, addressed to the VPA in `VITE_UPI_VPA` and the
   amount from step 2.
4. Student pays in their UPI app, then enters the transaction reference
   (UTR) and submits. This sets `status = 'submitted'`.
5. An admin reviews submitted payments at `/admin/payments` and approves
   or rejects.
6. On approval, a Postgres trigger (`trg_payment_approved` in
   `0001_init.sql`) automatically inserts/updates the matching
   `course_enrolments` row to `status = 'active'`. The student sees this
   on their dashboard — there is no separate "activate enrolment" step
   for the admin to forget.

## Why the amount can't drift

`payments.amount` is captured once, at creation time, from the course's
current price — this is intentional (a price change mid-payment shouldn't
retroactively change what a student already agreed to pay). If you want
"always re-check against current price at approval time" instead, add that
check inside the admin approval action before allowing `status = 'approved'`.

## What's NOT implemented yet

- Automatic reconciliation against a bank statement or UPI provider API
  (this remains a fully manual admin review, as specified)
- Refunds (schema doesn't yet have a refund status — add one before
  processing real refunds)
- Webhook-based payment confirmation (would replace manual UTR entry if
  you later integrate a gateway)
