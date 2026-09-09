// Firestore-backed types for the whole app (courses, payments,
// enrolments, certificates). Field names match the collections already
// read by the public site (Courses.tsx, CourseDetail.tsx, Home.tsx,
// CourseLearn.tsx) — those pages moved to Firestore first, and this
// migration brings the admin panel, payments, and student dashboard in
// line with the same collections instead of a separate Supabase schema.

export interface Course {
  id: string
  // Historically always null — no admin UI ever set this until the
  // catalog seed (see src/lib/catalog.ts). Kept as a plain string (not a
  // foreign key) because there is no separate Firestore `categories`
  // collection in this project; CATALOG_CATEGORIES in src/lib/catalog.ts
  // is the single source of truth for the three known slugs, but the
  // field stays a loose string so older/unrelated rows never fail to type.
  category_id: string | null
  name: string
  slug: string
  subject?: string | null
  short_description: string | null
  description: string | null
  level: 'beginner' | 'intermediate' | 'advanced' | 'professional' | null
  duration_text: string | null
  instructor_name: string | null
  cover_image_url: string | null
  preview_video_url: string | null
  base_fee: number
  discount_amount: number
  is_free: boolean
  is_published: boolean
  is_featured: boolean
  // New, additive field (default/absent = false = ordinary course).
  // Marks a catalog row as a VATTAMS Competition entry so it's excluded
  // from the public Courses grid/purchase-as-a-course flow and listed on
  // /competitions instead, while still reusing the same courses
  // collection, pricing, and enrolment architecture.
  is_competition?: boolean
  // ------------------------------------------------------------------
  // New, additive pricing-model fields (approved revenue-share model —
  // see src/lib/pricingModel.ts + src/lib/coursePricing.ts). IMPORTANT:
  // an ABSENT pricing_mode is no longer treated as "legacy" — it's
  // auto-classified instead (competition -> competition_entry, free ->
  // free, everything else -> monthly_group). This is what makes the
  // approved commercial model apply to all existing courses without
  // editing all 55 seeded documents. 'legacy' is now something an admin
  // must set EXPLICITLY to keep a specific course on the old one-time
  // base_fee/discount_amount pricing — see resolveEffectivePricingMode()
  // in src/lib/coursePricing.ts for the exact precedence rule.
  // ------------------------------------------------------------------
  pricing_mode?: 'legacy' | 'monthly_group' | 'one_to_one' | 'special_offer' | 'school_tuition'
  // School tuition plan selectors. These are only used when pricing_mode is 'school_tuition'.
  // The 4–6 and 6–8 bands intentionally remain separate, including class 6.
  tuition_board?: 'cbse' | 'matric' | 'international' | null
  tuition_session?: 'individual' | 'group' | null
  tuition_class_band?: '1_3' | '4_6' | '6_8' | '9_10' | null
  // Links this course to an approved tutor (tutors/{uid}) so the 40%
  // tutor share of each approved payment can be recorded against a
  // real payout ledger (src/lib/tutorEarnings.ts) instead of floating
  // unattached to anyone. instructor_name (above) stays a free-text
  // display label; this is the actual FK used for payouts.
  instructor_tutor_id?: string | null
  // Per-course override of the global monthly fee (settings/pricing).
  // Leave unset to use the current admin-configured default for this
  // pricing_mode (monthlyGroupFeePerStudent / oneToOneMonthlyFee).
  monthly_fee_override?: number | null
  // Only meaningful when pricing_mode is 'monthly_group'. Leave unset
  // to use the admin-configured default group batch size.
  batch_size_override?: number | null
  // Only meaningful when pricing_mode is 'special_offer'. Points at
  // which configured offer (settings/pricing.specialOffers) this
  // course uses.
  special_offer_key?: 'english_abacus' | 'phonics' | null
  created_at?: string
}

export interface Payment {
  id: string
  student_id: string | null
  course_id: string | null
  // Denormalized at creation time so payment/enrolment lists can render
  // without a join — Firestore has none, so the alternative is an extra
  // read per row on every list render.
  course_name: string | null
  student_name: string | null
  // Tutor registration payments use these optional fields; course payments remain unchanged.
  payment_type?: 'course' | 'tutor_registration'
  tutor_id?: string | null
  tutor_name?: string | null
  amount: number
  status: 'pending' | 'submitted' | 'approved' | 'rejected'
  utr_reference: string | null
  submitted_at: string | null
  verified_at: string | null
  verified_by: string | null
  admin_notes: string | null
  created_at: string
  // ------------------------------------------------------------------
  // New, additive monthly-billing fields. Absent on every historical
  // payment record (one-time legacy/competition/tutor-registration
  // payments never set these) — nothing here is backfilled onto old
  // docs. Set by Payment.tsx at creation time for a recurring course,
  // and finalized by AdminPayments.tsx at approval time.
  // ------------------------------------------------------------------
  // Which pricing mode this specific payment was charged under —
  // recorded on the payment itself so a later admin pricing-config
  // change never rewrites the meaning of a historical payment.
  pricing_mode_snapshot?: import('@/lib/coursePricing').EffectivePricingMode
  // YYYY-MM this payment covers, for a recurring monthly course. Null
  // for one-time (legacy/competition_entry/free) payments.
  billing_period?: string | null
  // Which special offer (if any) this payment was charged under.
  offer_key?: 'english_abacus' | 'phonics' | null
  // Which group batch this payment's student belongs to for this
  // course (monthly_group mode only) — set at approval time by
  // src/lib/groupBatches.ts.
  batch_number?: number | null
  // Snapshot of the 40/10/30/15/5 (or whatever the admin-configured
  // percentages were at approval time) split of `amount`, computed at
  // approval — see src/lib/pricingModel.ts computeRevenueSplit(). A
  // snapshot, not a live computation, so a later change to Admin →
  // Pricing percentages never silently rewrites a historical payout.
  revenue_split?: {
    tutor: number
    marketing: number
    management: number
    company: number
    saving: number
  } | null
}

export interface Enrolment {
  id: string
  student_id: string | null
  course_id: string | null
  course_name: string | null
  course_slug: string | null
  // Additive — mirrors the payment fields above, kept in sync at
  // approval time (AdminPayments.tsx) so CourseLearn.tsx / the student
  // dashboard can show which plan/batch/period is currently active
  // without a second read of the underlying payment.
  pricing_mode?: import('@/lib/coursePricing').EffectivePricingMode
  billing_period?: string | null
  batch_number?: number | null
  status: 'pending' | 'active' | 'revoked'
  enrolled_at: string | null
  created_at: string
}

export interface CertificateVerification {
  certificate_code: string
  student_name: string
  course_name: string | null
  certificate_type: string
  issued_at: string
  is_valid: boolean
}