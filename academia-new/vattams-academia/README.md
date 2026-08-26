# VATTAMS ACADEMIA

Learn &middot; Compete &middot; Certify &middot; Grow

## What's in this build

This is **Phase 1** of the platform: the foundation and one complete, real
end-to-end flow — not a mockup, not stubbed pages.

**Working right now:**
- Public course catalogue (published courses only, live pricing)
- Course detail → enrol → UPI payment (QR + deep link) → UTR submission
- Admin payment verification queue → approving auto-activates the enrolment
  (via a Postgres trigger, not frontend logic)
- Student dashboard (enrolments + payment history)
- Public certificate verification by code (RPC-based, no student data leak)
- Full Row Level Security on every table — nothing is open by accident
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
build the rest on top of — same schema conventions, same RLS pattern, same
"price lives in the database" rule throughout.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project + UPI VPA
```

Create a Supabase project, then run the migration:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Create your first admin manually (sign up as a normal user via `/register`,
then insert a matching row into `admins` with that user's `id` from the SQL
editor — there's intentionally no self-service admin signup).

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
- `supabase/migrations/0001_init.sql` — schema + RLS, read this before extending it
