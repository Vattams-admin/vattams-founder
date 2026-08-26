# Phase 19 — Live Sessions: delivery report

This is an honest audit against the Phase 19 spec's own final checklist,
written the same way the spec asked for it: "Do not mark any item as
complete unless it was actually verified." Nothing here has been run
against a live Firebase project or a real build — this environment has
no network access and no Firebase credentials (same constraint noted at
the top of `firestore.rules`).

## What the spec assumed that this project doesn't have

The spec's data model is COURSE → CLASSROOM → BATCH → TUTOR →
ENROLLED STUDENTS. This codebase has no `classrooms` or `batches`
collection, and no tutor↔course assignment table — a tutor document
(`src/types/academy.ts`) has a free-text `subjects` field, not a list
of course ids. Rather than invent Classroom/Batch collections nothing
else in the app reads (fake scaffolding), live sessions here are
scoped directly to the one grouping concept that already exists and
already gates access: `course_id` + the `enrolments` collection.
`batch_label` is a free-text display field, not a real relationship.

**Consequence:** any approved tutor can currently schedule a session
against any course — there is no enforcement that a tutor only teaches
"their" courses, because no data exists to define that. If that
restriction matters, the real fix is a `course_id` list (or a
dedicated assignment collection) on the tutor document, checked both
in `TutorLiveSessions.tsx`'s course dropdown and in the
`live_sessions` create/update rule.

## What's real and working

- [x] Scheduling — `TutorLiveSessions.tsx`, validated by
      `validateLiveSessionInput()` (required fields, valid dates, end
      after start, valid http(s) URLs).
- [x] Publishing — draft → published transition, notifies enrolled
      students.
- [x] Starting Soon / Live / Ended — computed live from
      `start_time`/`end_time` vs. the clock (`computeLiveSessionPhase`),
      never a manually-flipped field a human could forget to update.
- [x] Join flow — `LiveSession.tsx`, opens the tutor-supplied meeting
      URL in a new tab with a clear "you are joining an external
      meeting" message. No fake embedded video of any kind.
- [x] Attendance — self-reported on join click, explicitly labelled
      "(self-reported)" everywhere it's shown, plus tutor/admin manual
      override. Never claims verified attendance, because this project
      has no meeting-provider webhook/API to actually verify it.
- [x] Materials — free-text name+URL list on the session, validated as
      real http(s) links.
- [x] Recording — tutor attaches a URL after the fact; "Recording not
      available" shown otherwise. Nothing generates a fake URL.
- [x] Notifications — real, fired at real trigger points: published,
      rescheduled, cancelled, recording attached, and a manual
      "notify: live now" button. See the reminder gap below.
- [x] Rescheduling — updates time, keeps a `reschedule_history` audit
      trail, notifies students. History is append-only; nothing is
      deleted.
- [x] Cancellation — status flips to `cancelled`, reason stored,
      session row is never deleted (history preserved).
- [x] Tutor / Admin / Student permission surfaces — three distinct
      pages (`TutorLiveSessions.tsx`, `AdminLiveSessions.tsx`,
      `LiveSession.tsx` + `NextLiveSessionCard.tsx`).
- [x] RLS-equivalent enforcement — `firestore.rules`' new
      `live_sessions` / `session_attendance` blocks (see below); the
      join page's own access checks are UX only, not the real gate.
- [x] Timezone handling — every timestamp is stored as UTC ISO-8601 and
      rendered via the browser's own locale/timezone
      (`toLocaleString()`), so two students in different timezones each
      see the correct local time without a stored per-user timezone
      preference (this project has none).
- [x] Mobile layout — single-column stacked cards, no fixed-width
      elements, touch-sized buttons; not tested on an actual device
      (no device access here).

## What's NOT real, and why — read this before claiming it's done

- **24-hours-before / 1-hour-before reminders are NOT implemented.**
  These need something running at a specific clock time with nobody
  looking — a scheduled Cloud Function or cron job. This project is a
  pure client SPA with no backend of any kind (see
  `src/lib/notifications.ts`'s own header comment, written in an
  earlier phase). Building fake client-side polling to "guess" when to
  fire these would either miss the window (student not on the site at
  exactly T-1h) or spam on every page load — neither is honest
  reminder delivery. Real 24h/1h reminders need Cloud
  Functions + Cloud Scheduler (or an equivalent), which is new
  infrastructure this project doesn't have yet.
- **No embedded video, no live chat, no presence tracking.** All three
  are explicitly disallowed by the spec unless they already exist, and
  none did. The meeting happens entirely on the external provider's
  own page.
- **Attendance is not verified.** It is either a self-reported click or
  a human's manual entry — labelled as such everywhere, never
  presented as confirmed presence.
- **Tutor↔course assignment is not enforced** — see the section above.
- **The Firestore rules in this PR have not been deployed or tested**
  against a real project. The existing `firestore.rules` file already
  carries this exact caveat for the collections it covers; the new
  `live_sessions` / `session_attendance` blocks carry the same one.
  Run them through the Rules Playground, and merge the
  `notifications` rule addition documented in
  `docs/NOTIFICATIONS-FIRESTORE-RULES.md`, before deploying.
- **Build/TypeScript were not run** — no network access in this
  environment to install dependencies. Review the new files for
  straightforward type errors before merging; nothing here was
  compiled.

## Files touched

New:
- `src/types/liveSession.ts`
- `src/lib/liveSessions.ts`
- `src/components/live-session/NextLiveSessionCard.tsx`
- `src/pages/LiveSession.tsx`
- `src/pages/tutor/TutorLiveSessions.tsx`
- `src/pages/admin/AdminLiveSessions.tsx`
- `docs/LIVE-SESSIONS-DELIVERY-REPORT.md` (this file)

Modified:
- `src/types/notifications.ts` — added `class_live_now`,
  `class_recording_ready` (additive, per that file's own documented
  extension pattern).
- `src/pages/StudentDashboard.tsx` — embeds `NextLiveSessionCard`.
- `src/pages/TutorDashboard.tsx` — added a link to `/tutor/live-sessions`.
- `src/components/AdminNav.tsx` — added a "Live Sessions" nav item.
- `src/App.tsx` — added `/live-session/:sessionId`,
  `/tutor/live-sessions`, `/admin/live-sessions` routes.
- `firestore.rules` — added `live_sessions` / `session_attendance`
  blocks and the `hasActiveEnrolment()` / `isApprovedTutor()` helpers
  they use.
- `docs/NOTIFICATIONS-FIRESTORE-RULES.md` — documented the additional
  `notifications` create-rule branch tutors need for live-session
  notifications.

Nothing in Payment.tsx, CourseLearn.tsx, courses, certificates, or
existing enrolment flows was changed.
