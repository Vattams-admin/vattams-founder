# Phase status

Status legend: **Done** (implemented + working) · **Schema only** (DB modeled,
no UI/logic yet) · **Not started**

| Area | Frontend | Backend/DB | Security | Status |
|---|---|---|---|---|
| Public course catalogue | Done | Done | RLS: public read published only | **Done** |
| Course detail + live pricing | Done | Done (view `course_pricing`) | — | **Done** |
| Student auth (signup/login) | Done | Supabase Auth + `students` table | RLS: own row only | **Done** |
| Free-course enrolment | Done | Done | RLS on `course_enrolments` | **Done** |
| Paid enrolment via UPI + UTR | Done | `payments` table | RLS: student inserts/reads own; admin verifies | **Done** |
| Auto-activation on approval | — | Postgres trigger | `security definer` function | **Done** |
| Admin login | Done | `admins` table check | RLS gate via `is_admin()` | **Done** |
| Admin payment verification | Done | Done | Admin-only update policy | **Done** |
| Student dashboard | Done | Done | RLS: own data only | **Done** |
| Certificate public verification | Done | RPC `verify_certificate` | Minimal projection, no PII leak | **Done** |
| Certificate issuance flow | Not started | Table exists | — | **Schema only** |
| Course content player (video/PDF/text, resume, progress) | Done | Done | RLS ties access to active enrolment | **Done** |
| Course admin (create/edit/publish, pricing) | Done | Done | Admin write policy | **Done** |
| Competitive exam platform (catalogue) | Not started | Done (`exams`, `exam_subjects`) | RLS: public read published | **Schema done, no UI yet** |
| Question bank | Not started (admin UI) | Done (`questions`, `question_options`) | RLS: admin-only, never publicly readable | **Schema done, no admin UI yet** |
| Assessment engine (timed tests, negative marking, scoring) | Not started (attempt-taking UI) | Done — schema + server-side `submit_attempt()` scoring function | RLS: student owns in-progress attempt only; scoring runs `security definer` so clients can't fabricate scores | **Schema + scoring engine done, no test-taking UI yet** |
| Competitions + leaderboard | Not started | Not modeled | — | **Not started** |
| Assignments | Not started | Not modeled | — | **Not started** |
| Materials/PDF library UI | Not started | Not modeled | — | **Not started** |
| Notifications (in-app/push/email/WhatsApp) | Not started | Not modeled | — | **Not started** |
| Admin analytics/reporting | Not started | Not modeled | — | **Not started** |
| Audit logs | Not started | Not modeled | — | **Not started** |
| PWA installability | Manifest + SW configured | — | — | **Configured, needs real icons + device testing** |
| SEO (sitemap, structured data, OG) | robots.txt only | — | — | **Not started** |

## Recommended build order for the next passes

1. ~~Course content player + progress tracking~~ — **done**
2. ~~Admin course management UI~~ — **done**
3. ~~Question bank + assessment engine schema + server-side scoring~~ — **done** (migration 0002)
4. Test-taking UI (start attempt → answer/navigate/mark-for-review/auto-submit → call `submit_attempt()` → results screen) and admin question-bank/exam management UI — **next**
5. Certificate issuance (trigger on course completion or passed assessment → insert into `certificates`)
6. Competitions + leaderboard (reuses the assessment engine with `assessment_type = 'competitive_exam'` plus a ranking view)
7. Notifications, analytics, reporting, audit logs
8. SEO + PWA polish, accessibility audit, full QA pass per spec §44

**Note on verification:** this sandbox currently has no network access, so
`npm install` / `typecheck` / `build` could not be run here. Run all three
locally before deploying — see README.

No phase in this matrix is marked "Done" unless the code in this repo
actually implements it — nothing here is aspirational.
