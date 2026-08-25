# Notifications — Firestore security rules

There is no `firestore.rules` file in this repo — Firestore security
rules for VATTAMS ACADEMIA are managed by hand in the Firebase Console
(the same place `admins/{uid}` documents are created; see the comment
at the top of `src/lib/adminData.ts`). Because the existing rules for
`students`, `tutors`, `courses`, `payments`, `enrolments`, and
`certificates` aren't visible from this codebase, this file does **not**
hand you a full rules file to paste over whatever is already deployed —
doing that risks silently deleting rules for those collections. Instead,
add the `match /notifications/{notificationId} { ... }` block below
into your existing rules, inside the existing `match /databases/{database}/documents { ... }` block, alongside your other `match` blocks.

## Why the rules are shaped this way

This project has no Cloud Functions or other backend (see
`src/lib/firebase.ts` and the absence of a `functions/` directory) — the
whole app is a Firestore-backed client SPA, and `AdminPayments.tsx`
already does what would otherwise be a server-side trigger (activating
an enrolment right after approving a payment) directly from the admin's
authenticated client. The notification rules follow the same pattern,
with one added constraint: a newly-registered **student** or **tutor**
needs to alert the admin team (`new_student_registration`,
`tutor_activity`, `payment_received`) without the client ever knowing
which Firestore uids belong to admins — enumerating admin uids
client-side would leak admin identity to anyone with dev tools open.

The rules below solve this with a **role broadcast**: an admin- or
tutor-targeted notification can be written with `recipient_uid: null`
and `recipient_role: 'admin' | 'tutor'` instead of a specific uid, from
an allow-listed set of types. Only a verified admin (via the existing
`admins/{uid}` document — same check as `getAdminProfile()` in
`src/lib/adminData.ts`) can read or mark-read an admin broadcast; only a
verified tutor (`tutors/{uid}` with an approved status) can do the same
for a tutor broadcast.

**Tradeoff to know about:** because the notification schema is a single
document with one `is_read` boolean (per the fixed schema in the spec),
marking a broadcast notification read marks it read for *every* admin
(or tutor) who can see it — there's no per-recipient read state for a
shared broadcast. Fine for a small admin team; worth revisiting (e.g. a
`read_by: string[]` field) if the admin team grows.

## Rules to add

```
match /notifications/{notificationId} {
  // A verified, active admin — mirrors getAdminProfile() in
  // src/lib/adminData.ts exactly (admins/{uid}, is_active == true,
  // role in the recognized set).
  function isAdmin() {
    return request.auth != null &&
      exists(/databases/$(database)/documents/admins/$(request.auth.uid)) &&
      get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.is_active == true &&
      get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role in ['admin', 'super_admin', 'instructor'];
  }

  // A tutor whose application has been approved — mirrors
  // approveAcademyTutor() in src/lib/academyAdmin.ts (status: 'approved').
  function isApprovedTutor() {
    return request.auth != null &&
      exists(/databases/$(database)/documents/tutors/$(request.auth.uid)) &&
      get(/databases/$(database)/documents/tutors/$(request.auth.uid)).data.status == 'approved';
  }

  function isOwnNotification() {
    return request.auth != null && resource.data.recipient_uid == request.auth.uid;
  }

  function isAdminBroadcast() {
    return resource.data.recipient_uid == null && resource.data.recipient_role == 'admin';
  }

  function isTutorBroadcast() {
    return resource.data.recipient_uid == null && resource.data.recipient_role == 'tutor';
  }

  // READ: your own notifications, or a broadcast for a role you
  // actually hold (verified server-side via the functions above — a
  // student can never read an admin/tutor broadcast).
  allow read: if isOwnNotification()
    || (isAdminBroadcast() && isAdmin())
    || (isTutorBroadcast() && isApprovedTutor());

  // CREATE — three shapes, matching src/lib/notifications.ts:
  allow create: if request.auth != null && request.resource.data.is_read == false
    && request.resource.data.keys().hasAll(['recipient_uid','recipient_role','type','title','message','is_read','created_at'])
    && (
      // 1) A verified admin may notify anyone, of any type — covers
      //    every notification an admin action creates on a student's
      //    behalf (payment_success, enrollment_success,
      //    certificate_issued, admin_announcement, new_enrollment, ...).
      isAdmin()

      // 2) Self-notification: a signed-in user creating a notification
      //    for their own uid, restricted to the one type that's
      //    actually self-issued in this app (a student's own
      //    registration_success right after signup — see
      //    src/pages/StudentRegister.tsx).
      || (request.resource.data.recipient_uid == request.auth.uid
          && request.resource.data.type == 'registration_success')

      // 3) Public admin broadcast: any authenticated user (a
      //    just-registered student/tutor, or a student submitting a
      //    payment) may ping the admin team, but ONLY this narrow,
      //    allow-listed shape — never a specific recipient_uid, never
      //    an arbitrary type.
      || (request.resource.data.recipient_uid == null
          && request.resource.data.recipient_role == 'admin'
          && request.resource.data.type in ['new_student_registration', 'tutor_activity', 'payment_received'])
    );

  // UPDATE (mark as read / mark all as read): only the is_read field
  // may change, and only by someone allowed to read this document in
  // the first place. recipient_uid, recipient_role, type, and every
  // other field are immutable after creation — this is what stops a
  // student from re-addressing another user's notification or
  // impersonating a different recipient.
  allow update: if (isOwnNotification() || (isAdminBroadcast() && isAdmin()) || (isTutorBroadcast() && isApprovedTutor()))
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['is_read']);

  // No client-side deletes — nothing in this app needs to delete a
  // notification; add an admin-only rule here if that changes.
  allow delete: if false;
}
```
