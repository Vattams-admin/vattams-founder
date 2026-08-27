# VATTAMS ACADEMIA — Notification System: Delivery Report

## 1. Files created
- `src/types/notifications.ts` — types, notification-type constants (per role), icon/label metadata
- `src/lib/notifications.ts` — the reusable Firestore notification service (`createNotification`, `createAdminBroadcast`, `createTutorBroadcast`, `getUserNotifications`, `subscribeToUserNotifications`, `getUnreadNotificationCount`, `subscribeToUnreadCount`, `markNotificationAsRead`, `markAllNotificationsAsRead`)
- `src/hooks/useUserRole.ts` — resolves a signed-in user's role (student/approved tutor) since `useAuth()` only exposes the raw Firebase user
- `src/hooks/useNotifications.ts` — shared realtime hook (feed + unread count) used by both the bell and the full page
- `src/components/NotificationBell.tsx` — bell icon, unread badge, dropdown panel (loading/empty/error states, mark-as-read, mark-all-read)
- `src/pages/Notifications.tsx` — full notification page for students/tutors (`/notifications`), with All/Unread filter, day-grouping, "load more"
- `src/pages/admin/AdminNotifications.tsx` — full notification page for admins (`/admin/notifications`), same shape
- `docs/NOTIFICATIONS-FIRESTORE-RULES.md` — the security-rules snippet to add (see §6 — deliberately not a full `firestore.rules` file)

## 2. Files modified
- `src/components/Navbar.tsx` — added the bell (desktop + mobile) next to the existing Dashboard/Log out controls, no layout redesign
- `src/components/AdminNav.tsx` — added the bell inline with the existing nav links; resolves the admin identity itself via `useAdminAuth()` so no existing admin page needed to change
- `src/App.tsx` — added `/notifications` (public route, redirects to `/login` if signed out, same pattern as `StudentDashboard`) and `/admin/notifications` (wrapped in the existing `AdminRoute` guard)
- `src/pages/StudentRegister.tsx` — after the student profile write succeeds: self `registration_success` notification + admin broadcast `new_student_registration`
- `src/pages/TutorRegister.tsx` — after the tutor profile write succeeds: admin broadcast `tutor_activity`
- `src/pages/Payment.tsx` — after a student submits a UTR reference: admin broadcast `payment_received`
- `src/pages/admin/AdminPayments.tsx` — after an admin approves a payment (enrolment activation): student `payment_success`, student `enrollment_success` (see §5 on `course_access_granted`), admin broadcast `new_enrollment`
- `src/pages/admin/AdminCertificates.tsx` — after a certificate is issued: student `certificate_issued`, with `action_url` deep-linking into the verify page
- `src/pages/VerifyCertificate.tsx` — added optional `?code=` query-param support (prefills + auto-verifies) purely so `certificate_issued`'s `action_url` actually lands somewhere useful; manual entry behaves exactly as before

All nine integration points call the notification service **after** the real write succeeds, never `await` it before navigating, and `createNotification()` itself never throws — a failed notification write cannot break registration, payment, enrolment, or certificate issuance.

## 3. Firestore collection/schema
`notifications/{notificationId}` — exactly the fields in the spec (`recipient_uid`, `recipient_role`, `type`, `title`, `message`, `related_id`, `related_type`, `action_url`, `is_read`, `created_at`), with `created_at` as a client `new Date().toISOString()` string, matching the convention already used by `students`, `tutors`, `payments`, and `certificates` in this codebase (not `serverTimestamp()`).

**Recipient model** (see the long comment at the top of `src/lib/notifications.ts` for full reasoning): this project has no Cloud Functions and no backend of any kind — it's a pure client SPA. So a notification either targets one specific `recipient_uid`, or is a **role broadcast** (`recipient_uid: null`, `recipient_role: 'admin' | 'tutor'`) that any admin/approved-tutor can read. This avoids the alternative of enumerating admin uids client-side, which would leak admin identity to a signed-in student. **Tradeoff:** because `is_read` is a single field on a shared document (the schema is fixed by spec), marking a broadcast read marks it read for every admin/tutor who can see it — there's no per-recipient read state. Fine for a small team; would need a `read_by: string[]` field to fix properly.

## 4. Notification types implemented
All 20 types from the spec are defined and rendered (icon + label) in `src/types/notifications.ts`. Wired to a real, automatic trigger:

| Type | Role | Trigger |
|---|---|---|
| `registration_success` | student | `StudentRegister.tsx` |
| `payment_success` | student | `AdminPayments.tsx` (approve) |
| `enrollment_success` | student | `AdminPayments.tsx` (approve) |
| `certificate_issued` | student | `AdminCertificates.tsx` |
| `new_student_registration` | admin | `StudentRegister.tsx` |
| `tutor_activity` | admin | `TutorRegister.tsx` |
| `payment_received` | admin | `Payment.tsx` (UTR submit) |
| `new_enrollment` | admin | `AdminPayments.tsx` (approve) |

The remaining types (`course_access_granted`, `new_course_material`, `class_reminder`, `class_cancelled`, `class_rescheduled`, `admin_announcement`, and every `TUTOR` type, `system_alert`) are defined, extensible, and fully supported by the service — but have **no existing event to attach to**. See §9 — none were faked.

## 5. Notes on specific type decisions
- **`course_access_granted`** is folded into the same moment as `enrollment_success` (both fire together in `AdminPayments.tsx`) rather than as a third near-duplicate notification, because this codebase has no separate access-gating step beyond the enrolment going `active` — course access *is* enrolment here. The type constant still exists for when a real drip-content/gating feature is built.
- **`payment_received` (admin)** fires when the *student* submits their UTR reference, not when the admin later approves it — that's the actual "something needs your attention" moment.
- **`new_enrollment` (admin)** fires alongside the student's own `enrollment_success`, informing the whole admin team (not just the approving admin) that a new enrolment went active — useful for a team, harmless for a solo admin.

## 6. Security-rule changes
**No `firestore.rules` file existed in this repo** — rules are managed by hand in the Firebase Console (same place `admins/{uid}` docs are created; see `src/lib/adminData.ts`). Since the actual deployed rules for `students`/`tutors`/`courses`/`payments`/`enrolments`/`certificates` aren't visible from the codebase, I did **not** generate a full `firestore.rules` file — deploying one wholesale risks silently deleting whatever rules already protect those collections.

Instead: **`docs/NOTIFICATIONS-FIRESTORE-RULES.md`** contains just the `match /notifications/{notificationId} { ... }` block to paste into your existing rules, plus the reasoning behind every clause. Summary of what it enforces (all of §10 in the brief):
- A user can read only their own notifications, or a role broadcast for a role they actually verifiably hold (checked server-side against `admins/{uid}` / `tutors/{uid}` — the same authorization documents the rest of the app already trusts).
- A user can mark only notifications they can read; `update` only ever touches `is_read` — `recipient_uid`, `recipient_role`, and `type` are immutable, which is what stops re-targeting/impersonation via update.
- A student/tutor can create a notification for themselves only as `registration_success`, or ping the admin team only via the three allow-listed broadcast types — never an arbitrary uid, never an arbitrary type, never an admin/tutor notification with real content control.
- An admin (verified the same way `getAdminProfile()` already does) may create any notification, matching "admin permissions follow the existing admin authorization model."
- No deletes.

One consequence worth flagging: `useUserRole.ts` only resolves a tutor's role as `'tutor'` if their `tutors/{uid}` document has `status: 'approved'` — matching the rule's `isApprovedTutor()`. A tutor still in `pending_approval` sees no bell/notifications rather than hitting a `permission-denied` in the console.

## 7. New dependencies
**None.** No icon library, no toast library — the bell/panel use hand-drawn inline SVGs matching the existing Navbar hamburger-icon pattern, and Tailwind's existing `.card` / `.btn-primary` / `.btn-secondary` utilities.

## 8. Build result
**Could not run `npm run build`** in this environment — `npm install` fails with `403 Forbidden` from the registry (no network egress available here), and no `node_modules`/npm cache exists to fall back to offline. I could not execute TypeScript's compiler, so this was not machine-verified.

What I did instead, since I take "fix all build errors" seriously even without a compiler available:
- Manually traced every new import against its actual export (no mismatched names)
- Verified every new/edited file's braces and parens balance (`grep -c` sanity pass across all 16 touched files)
- Checked every new file against `tsconfig.json`'s `strict`, `noUnusedLocals`, and `noUnusedParameters` settings by hand — no unused imports/locals left in
- Cross-checked Firebase SDK APIs used (`getCountFromServer`, aggregate-query `onSnapshot`, `writeBatch`) against the installed `firebase: ^12.18.0`, which supports all of them

**Please run `npm install && npm run build` on your end before deploying** — I'd treat this build as unverified until that's green.

## 9. Events that could not be automatically integrated
Reported honestly rather than faked, per the brief:

- **All `TUTOR` notification types** (`new_student_enrollment`, `course_assignment`, `class_scheduled`, `class_reminder`, `enrollment_update`): `Course` (`src/types/database.ts`) has only a free-text `instructor_name` string — there is no `instructor_id`/tutor-uid field linking a course to a specific tutor's Firestore account. Without that link there's no way to know *which* tutor to notify. Needs a schema addition (e.g. `instructor_uid` on `Course`) before these can be wired for real.
- **`new_course_material`**: there is no lesson/module-authoring UI anywhere in the admin panel — `CourseLearn.tsx` reads a `lessons`/`modules` structure that nothing in this repo ever writes to. No "material added" event exists to hook.
- **`class_reminder` / `class_cancelled` / `class_rescheduled` / `class_scheduled`** (both student and tutor): there is no live-classroom/scheduling feature in this codebase at all — `CourseLearn.tsx` is self-paced lesson content, not scheduled sessions. Point 9 of the brief ("prepare notification support... only where the existing classroom implementation supports it") is honored: the types exist and the service can fire them the moment a real classroom feature lands, but nothing invents a fake class schedule to hang them on.
- **`admin_announcement`**: no broadcast-composer UI exists to trigger this from. The type is fully supported by `createNotification`/`createAdminBroadcast`/`createTutorBroadcast` — an admin UI to compose one would be a small follow-up, not a notification-system change.
- **`system_alert`**: inherently a manual/operational type (e.g. "payment gateway down") with no corresponding app event — left available for future manual/admin use.

## 10. Other things worth knowing
- **Existing tutor "portal" gap**: after logging in, a tutor is routed to `/dashboard`, which is `StudentDashboard.tsx` — it queries `enrolments`/`payments` filtered by `student_id`, so a tutor sees an effectively empty page. This predates this change; not something a notification system should fix on its own, but it's *why* tutor notifications currently have nowhere dedicated to live beyond the shared Navbar bell and `/notifications`.
- `/admin/payments`, `/admin/courses`, and `/admin/courses/:id` are **not** wrapped in `AdminRoute` (a pre-existing gap noted in that file's own comment) — the notification bell now appears there too via `AdminNav`, but actual protection still comes entirely from Firestore rules, same as the rest of that page's data.
- The full notification page uses a bounded "Load more" (30 → up to 150 rows) rather than true cursor pagination, to stay simple while still honoring "don't unnecessarily load the entire history."
