# VATTAMS ACADEMIA

Learn &middot; Compete &middot; Certify &middot; Grow

## What's in this build

This is **Phase 1** of the platform: the foundation and one complete, real
end-to-end flow — not a mockup, not stubbed pages.

**Working right now:**
- Public course catalogue (published courses only, live pricing)
- Course detail → enrol → UPI payment (QR + deep link) → UTR submission
- Admin payment verification queue → approving activates the enrolment
- Student dashboard (enrolments + payment history)
- Public certificate verification by code (no student data leak)
- Firestore security rules on every collection — nothing is open by accident
- PWA scaffold (manifest, service worker via vite-plugin-pwa)

**Not built yet** (see `docs/PHASE-MASTER-MATRIX.md`):
- Competitive exam platform, question bank, assessment/mock-test engine
- Competitions + leaderboard
- Assignments
- Materials/PDF library
- Certificate *generation* (verification exists; issuing flow doesn't yet)
- Notification centre
- Admin course/exam/material management UI (schema exists, no UI yet)
- Analytics & reporting
- Full 70-phase documentation set

This was a deliberate call: a real, secure, working slice beats a large
pile of stubbed screens with fake data. Everything above is a good base to
build the rest on top of — same Firestore data conventions, same security
rules pattern throughout.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your Firebase project + UPI VPA
```

Create a Firebase project (Auth + Firestore + Storage enabled), grab the web
app config from Firebase Console → Project settings → General → Your apps →
SDK setup and configuration, and fill in the `VITE_FIREBASE_*` values in
`.env.local`. Deploy the Firestore security rules:

```bash
firebase deploy --only firestore:rules
```

Create your first admin manually (sign up as a normal user via `/register`,
then set that user's role/admin flag directly in the Firestore console —
there's intentionally no self-service admin signup).

```bash
npm run dev
```

## Scripts

- `npm run dev` — local dev server
- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint
- `npm run build` — production build

## Docs

- `docs/PHASE-MASTER-MATRIX.md` — honest status per feature area
- `docs/PAYMENT-GUIDE.md` — how the UPI/UTR flow works end to end
- `firestore.rules` — security rules, read this before extending the schema
