// src/lib/pricingModel.ts
//
// Single source of truth for the VATTAMS revenue-share pricing model
// (approved pricing, supersedes the old sample PDF). Every number in
// here is a *default* — the actual values used at runtime come from
// the admin-configurable `settings/pricing` Firestore doc (see
// src/lib/pricingConfig.ts), which is seeded with these defaults the
// first time it's read. Nothing here is a substitute for that doc;
// this module only owns the *shape* of the config and the *math*, so
// the formula is written once and reused everywhere (admin preview,
// course form, any future payment/payout code) instead of being
// hand-copied per screen.
//
// This module deliberately does NOT touch existing course pricing
// (Course.base_fee / discount_amount) — those fields keep working
// exactly as before for the 55 seeded catalog rows and any other
// one-time-fee course. This engine is additive: it powers the new
// monthly-group / one-to-one / special-offer pricing modes described
// in the approved model, layered on top of the existing schema (see
// the new optional Course.pricing_mode field in src/types/database.ts).

export interface RevenueShare {
  tutor: number
  marketing: number
  management: number
  company: number
  saving: number
}

// Approved split: Tutor 40% / Marketing 10% / Management 30% /
// Company 15% / Saving 5%.
export const DEFAULT_REVENUE_SHARE: RevenueShare = {
  tutor: 40,
  marketing: 10,
  management: 30,
  company: 15,
  saving: 5,
}

export interface SpecialOfferConfig {
  /** Regular (non-offer) monthly price, for display/reference only. */
  regularPrice: number
  /** Actual price collected while the offer is active. */
  offerPrice: number
  /** How many months a given student gets the offer price for. `null` = no time limit. */
  offerDurationMonths: number | null
  /** How many students (first N sign-ups) can take the offer. `null` = unlimited. */
  offerMaxStudents: number | null
  /** Whether students who take this offer also get free entry to upcoming VATTAMS competitions. */
  includesFreeCompetitionEntry: boolean
  /** Admin on/off switch — lets the offer be retired without deleting its configured numbers. */
  isActive: boolean
}

export type SchoolTuitionBoard = 'cbse' | 'matric' | 'international'
export type SchoolTuitionSession = 'individual' | 'group'
export type SchoolTuitionClassBand = '1_3' | '4_6' | '6_8' | '9_10'

export interface SchoolTuitionPlan {
  regularPrice: number
  launchDiscountPercent: number
  testSeriesIncluded?: boolean
}

export interface SchoolTuitionPricing {
  /** Student-facing school tuition master. */
  plans: Record<string, SchoolTuitionPlan>
  /** Launch offer applies to the first N students. */
  launchMaxStudents: number
  /** Launch price applies for this many monthly billing periods. */
  launchDurationMonths: number
  /** Group sessions are intended for batches of 3 or 4 students. */
  groupBatchMinSize: number
  groupBatchMaxSize: number
}

export interface CatalogCoursePricePlan {
  regularPrice: number
  launchDiscountPercent: number
}

export interface CatalogCoursePricing {
  plans: Record<string, CatalogCoursePricePlan>
}

export interface PricingConfig {
  /** Per-student monthly fee for a group session. */
  monthlyGroupFeePerStudent: number
  /** Students per group batch (Karthi Tutor rule: 4/batch). */
  groupBatchSize: number
  /** Monthly fee for one-to-one sessions. */
  oneToOneMonthlyFee: number
  /** The 40/10/30/15/5 split, applied to every actual collected rupee. */
  revenueShare: RevenueShare
  specialOffers: {
    englishAbacus: SpecialOfferConfig
    phonics: SpecialOfferConfig
  }
  schoolTuition: SchoolTuitionPricing
  catalogCourses: CatalogCoursePricing
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  monthlyGroupFeePerStudent: 10000,
  groupBatchSize: 4,
  oneToOneMonthlyFee: 14000,
  revenueShare: DEFAULT_REVENUE_SHARE,
  specialOffers: {
    englishAbacus: {
      regularPrice: 4000,
      offerPrice: 2000,
      offerDurationMonths: null, // "initial offer price" — no stated end date
      offerMaxStudents: null,
      includesFreeCompetitionEntry: false,
      isActive: true,
    },
    phonics: {
      regularPrice: 10000,
      offerPrice: 5000,
      offerDurationMonths: 3,
      offerMaxStudents: 30,
      includesFreeCompetitionEntry: true,
      isActive: true,
    },
  },
  schoolTuition: {
    plans: {
      cbse_individual_1_3: { regularPrice: 6000, launchDiscountPercent: 50 },
      cbse_individual_4_6: { regularPrice: 7500, launchDiscountPercent: 50 },
      cbse_individual_6_8: { regularPrice: 8000, launchDiscountPercent: 50 },
      cbse_individual_9_10: { regularPrice: 20000, launchDiscountPercent: 50, testSeriesIncluded: true },

      matric_individual_1_3: { regularPrice: 4000, launchDiscountPercent: 50 },
      matric_individual_4_6: { regularPrice: 5500, launchDiscountPercent: 50 },
      matric_individual_6_8: { regularPrice: 6000, launchDiscountPercent: 50 },
      matric_individual_9_10: { regularPrice: 12500, launchDiscountPercent: 50 },

      international_individual_1_3: { regularPrice: 12000, launchDiscountPercent: 50 },
      international_individual_4_6: { regularPrice: 9500, launchDiscountPercent: 50 },
      international_individual_6_8: { regularPrice: 13000, launchDiscountPercent: 50 },
      international_individual_9_10: { regularPrice: 25000, launchDiscountPercent: 50 },

      cbse_group_1_3: { regularPrice: 4000, launchDiscountPercent: 50 },
      cbse_group_4_6: { regularPrice: 4500, launchDiscountPercent: 50 },
      cbse_group_6_8: { regularPrice: 4000, launchDiscountPercent: 50 },
      cbse_group_9_10: { regularPrice: 10000, launchDiscountPercent: 50, testSeriesIncluded: true },

      matric_group_1_3: { regularPrice: 2500, launchDiscountPercent: 50 },
      matric_group_4_6: { regularPrice: 4500, launchDiscountPercent: 50 },
      matric_group_6_8: { regularPrice: 5000, launchDiscountPercent: 50 },
      matric_group_9_10: { regularPrice: 8500, launchDiscountPercent: 50 },

      international_group_1_3: { regularPrice: 9000, launchDiscountPercent: 50 },
      international_group_4_6: { regularPrice: 7500, launchDiscountPercent: 50 },
      international_group_6_8: { regularPrice: 9000, launchDiscountPercent: 50 },
      international_group_9_10: { regularPrice: 15000, launchDiscountPercent: 50 },
    },
    launchMaxStudents: 50,
    launchDurationMonths: 3,
    groupBatchMinSize: 3,
    groupBatchMaxSize: 4,
  },
  catalogCourses: {
    plans: {
      // Competitive Exams — 30% launch discount
      'competitive-exams:TNPSC Group I': { regularPrice: 7000, launchDiscountPercent: 30 },
      'competitive-exams:TNPSC Group II / IIA': { regularPrice: 5000, launchDiscountPercent: 30 },
      'competitive-exams:TNPSC Group IV / VAO': { regularPrice: 3000, launchDiscountPercent: 30 },
      'competitive-exams:TNPSC Complete Package': { regularPrice: 10000, launchDiscountPercent: 30 },
      'competitive-exams:SSC CGL': { regularPrice: 5000, launchDiscountPercent: 30 },
      'competitive-exams:SSC CHSL': { regularPrice: 4000, launchDiscountPercent: 30 },
      'competitive-exams:SSC MTS / GD': { regularPrice: 2500, launchDiscountPercent: 30 },
      'competitive-exams:SSC Complete Package': { regularPrice: 7000, launchDiscountPercent: 30 },
      'competitive-exams:Banking – IBPS': { regularPrice: 4500, launchDiscountPercent: 30 },
      'competitive-exams:SBI Exams': { regularPrice: 4500, launchDiscountPercent: 30 },
      'competitive-exams:RBI Exams': { regularPrice: 6000, launchDiscountPercent: 30 },
      'competitive-exams:Banking Complete Package': { regularPrice: 7000, launchDiscountPercent: 30 },
      'competitive-exams:RRB NTPC': { regularPrice: 4000, launchDiscountPercent: 30 },
      'competitive-exams:Railway Group D': { regularPrice: 2500, launchDiscountPercent: 30 },
      'competitive-exams:RRB ALP / Technician': { regularPrice: 3500, launchDiscountPercent: 30 },
      'competitive-exams:Railway Complete Package': { regularPrice: 6000, launchDiscountPercent: 30 },
      'competitive-exams:Police Exams': { regularPrice: 2500, launchDiscountPercent: 30 },
      'competitive-exams:Defence Exams': { regularPrice: 3000, launchDiscountPercent: 30 },
      'competitive-exams:TET – Tamil / English': { regularPrice: 3500, launchDiscountPercent: 30 },
      'competitive-exams:TET Complete Package': { regularPrice: 5000, launchDiscountPercent: 30 },
      'competitive-exams:UGC NET': { regularPrice: 6000, launchDiscountPercent: 30 },
      'competitive-exams:SET': { regularPrice: 4500, launchDiscountPercent: 30 },
      'competitive-exams:Teaching & School Jobs': { regularPrice: 3000, launchDiscountPercent: 30 },

      // Academic & Skill — 50% launch discount
      'academic-skill:College – Individual Subject': { regularPrice: 2500, launchDiscountPercent: 50 },
      'academic-skill:College – Complete Subject Pack': { regularPrice: 5000, launchDiscountPercent: 50 },
      'academic-skill:Competitive Foundation': { regularPrice: 3000, launchDiscountPercent: 50 },
      'academic-skill:Computer Basics': { regularPrice: 1500, launchDiscountPercent: 50 },
      'academic-skill:MS Office': { regularPrice: 2000, launchDiscountPercent: 50 },
      'academic-skill:Programming Fundamentals': { regularPrice: 3000, launchDiscountPercent: 50 },
      'academic-skill:Spoken English': { regularPrice: 2000, launchDiscountPercent: 50 },
      'academic-skill:Soft Skills': { regularPrice: 2000, launchDiscountPercent: 50 },
      'academic-skill:Certification – Basic': { regularPrice: 2000, launchDiscountPercent: 50 },
      'academic-skill:Certification – Advanced': { regularPrice: 4000, launchDiscountPercent: 50 },

        // VATTAMS Competitions — 20% launch discount
        'vattams-competitions:Mathematics Challenge': { regularPrice: 500, launchDiscountPercent: 20 },
        'vattams-competitions:Science Challenge': { regularPrice: 500, launchDiscountPercent: 20 },
        'vattams-competitions:English Challenge': { regularPrice: 500, launchDiscountPercent: 20 },
        'vattams-competitions:Computer Challenge': { regularPrice: 500, launchDiscountPercent: 20 },
        'vattams-competitions:GK Challenge': { regularPrice: 500, launchDiscountPercent: 20 },
        'vattams-competitions:Reasoning Challenge': { regularPrice: 500, launchDiscountPercent: 20 },
        'vattams-competitions:India GK Championship': { regularPrice: 750, launchDiscountPercent: 20 },
        'vattams-competitions:National Quiz Championship': { regularPrice: 750, launchDiscountPercent: 20 },
        'vattams-competitions:AI & Technology Challenge': { regularPrice: 1000, launchDiscountPercent: 20 },
        'vattams-competitions:International Knowledge Challenge': { regularPrice: 1000, launchDiscountPercent: 20 },
        'vattams-competitions:National Mathematics Championship': { regularPrice: 1000, launchDiscountPercent: 20 },
        'vattams-competitions:National Science Championship': { regularPrice: 1000, launchDiscountPercent: 20 },
        'vattams-competitions:National English Championship': { regularPrice: 1000, launchDiscountPercent: 20 },
        'vattams-competitions:National Aptitude Championship': { regularPrice: 1000, launchDiscountPercent: 20 },
        'vattams-competitions:National Coding Challenge': { regularPrice: 1250, launchDiscountPercent: 20 },
        'vattams-competitions:National AI Challenge': { regularPrice: 1250, launchDiscountPercent: 20 },
        'vattams-competitions:Mega Inter-School Championship': { regularPrice: 1500, launchDiscountPercent: 20 },
        'vattams-competitions:Indian Classical Literature & Wisdom Championship': { regularPrice: 1000, launchDiscountPercent: 20 },
        'vattams-competitions:Indian Language Literature Masters Series': { regularPrice: 1000, launchDiscountPercent: 20 },
        'vattams-competitions:Thirukkural Mastery Championship': { regularPrice: 750, launchDiscountPercent: 20 },
        'vattams-competitions:Fun with Maths Challenge': { regularPrice: 500, launchDiscountPercent: 20 },
        'vattams-competitions:Azhagu Tamil Challenge': { regularPrice: 500, launchDiscountPercent: 20 },
        'vattams-competitions:Handwriting Excellence Challenge': { regularPrice: 500, launchDiscountPercent: 20 },
        'vattams-competitions:Spoken Hindi Challenge': { regularPrice: 500, launchDiscountPercent: 20 },
    },
  },
}
export interface RevenueSplit {
  total: number
  tutor: number
  marketing: number
  management: number
  company: number
  saving: number
}

/** Sum of the five share percentages — must equal 100 for a valid config. */
export function revenueShareTotal(share: RevenueShare): number {
  return share.tutor + share.marketing + share.management + share.company + share.saving
}

export function isValidRevenueShare(share: RevenueShare): boolean {
  return (
    Object.values(share).every((v) => Number.isFinite(v) && v >= 0) &&
    Math.abs(revenueShareTotal(share) - 100) < 1e-9
  )
}

/**
 * Splits `amount` (whole rupees) across the five buckets using `share`
 * percentages. Each bucket is rounded to the nearest rupee; any
 * rounding remainder (at most a few paise worth of rupees) is folded
 * into the "management" bucket last, so the five parts always sum to
 * exactly `amount` — every worked example in the approved model (₹10,000,
 * ₹40,000, ₹14,000, ₹2,000, ₹5,000) divides evenly already and is
 * unaffected; this only matters for future amounts that don't.
 */
export function computeRevenueSplit(amount: number, share: RevenueShare = DEFAULT_REVENUE_SHARE): RevenueSplit {
  const tutor = Math.round((amount * share.tutor) / 100)
  const marketing = Math.round((amount * share.marketing) / 100)
  const company = Math.round((amount * share.company) / 100)
  const saving = Math.round((amount * share.saving) / 100)
  const management = amount - (tutor + marketing + company + saving)

  return { total: amount, tutor, marketing, management, company, saving }
}

/**
 * Karthi Tutor group-batch rule: a full batch of `batchSize` students
 * each paying `perStudentFee` collects `perStudentFee * batchSize`
 * total, which is then split the same way as any other amount.
 */
export function computeGroupBatchSplit(
  perStudentFee: number,
  batchSize: number,
  share: RevenueShare = DEFAULT_REVENUE_SHARE
): RevenueSplit {
  return computeRevenueSplit(perStudentFee * batchSize, share)
}

export function computeOneToOneSplit(monthlyFee: number, share: RevenueShare = DEFAULT_REVENUE_SHARE): RevenueSplit {
  return computeRevenueSplit(monthlyFee, share)
}

/** Special-offer split always uses the *actual collected* offer price, never the regular price. */
export function computeSpecialOfferSplit(
  offer: SpecialOfferConfig,
  share: RevenueShare = DEFAULT_REVENUE_SHARE
): RevenueSplit {
  return computeRevenueSplit(offer.offerPrice, share)
}
