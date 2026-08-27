# VATTAMS ACADEMIA — CTO Security/Architecture Continuation

## Locked architecture
- Firebase only: Authentication, Firestore, Storage.
- No Supabase dependency or source reference remains.

## Actions completed
1. Merged the audited Firestore collections into the active rules file while preserving the existing Live Sessions and Attendance rules.
2. Added explicit rules for courses, nested course materials, course modules, lessons, progress, enrolments, payments, certificates, and notifications.
3. Preserved default-deny fallback.
4. Tightened student payment updates so a student can change only `status`, `utr_reference`, and `submitted_at` during `pending -> submitted`.
5. Tightened notification creation:
   - non-admin admin broadcasts limited to the actual registration/payment/tutor activity types;
   - approved tutors can notify enrolled students only for owned live sessions and allow-listed live-session notification types;
   - admin authority remains unrestricted within the notifications collection.
6. Fixed the active learning flow to use the canonical `enrolments` collection instead of the stale `course_enrolments` name.
7. Added `student_id == current user` to the progress query so the query matches its Firestore security rule.
8. Updated the unused CourseLearn backup to the same canonical collection name.
9. Verified no `supabase`, `@supabase`, or `SUPABASE` references remain in the project source/config/package lock.
10. Kept Firebase CLI wiring for Firestore and Storage rules in `firebase.json`.

## Verification status
- Static source/config checks: PASS.
- Supabase reference scan: PASS (none found).
- Canonical enrolment collection scan: PASS (no `course_enrolments` source references).
- Rules collection coverage: PASS for all collections used by the active app, including Live Sessions.
- Full TypeScript/Vite build: NOT CLAIMED. `npm ci --ignore-scripts --no-audit --no-fund` timed out in the restricted execution environment before dependencies became available.
- Live Firebase rules deployment/playground verification: NOT CLAIMED because Firebase credentials/network access are not available in this execution environment.

## Important deployment boundary
The merged rules are prepared for the active codebase, but production deployment must still be performed against the real VATTAMS ACADEMIA Firebase project and verified there. Do not overwrite unrelated production rules if the live project contains collections outside this repository.
