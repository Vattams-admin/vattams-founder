// src/lib/coursePricing.ts
//
// This is the missing piece from the first pricing pass: it decides,
// for a given Course document, which pricing mode ACTUALLY applies —
// without requiring an admin to have manually set `pricing_mode` on
// every course. The rule (see resolveEffectivePricingMode):
//
//   1. An explicit `pricing_mode` on the course (including explicitly
//      'legacy') always wins — admins keep full manual override.
//   2. Otherwise (the default for all existing/未-tagged courses):
//        - is_competition   -> 'competition_entry' (unchanged: one-time
//          entry fee via base_fee/discount_amount, exactly as today —
//          VATTAMS Competitions intentionally keep their own model).
//        - is_free          -> 'free' (unchanged).
//        - anything else    -> 'monthly_group' (the new approved
//          commercial model, applied automatically).
//
// This means every one of the ~38 non-competition, non-free catalog
// courses now uses the ₹10,000/month group model by default — not
// because their Firestore docs were bulk-edited (they weren't; no
// existing course document is modified by this file), but because
// nothing reads base_fee/discount_amount as the charge for those
// courses anymore. base_fee/discount_amount stay in the document,
// untouched, for history/reference and for the 'legacy'/
// 'competition_entry' courses that still price off them.

import type { Course } from '@/types/database'
import {
  computeRevenueSplit,
  type PricingConfig,
  type RevenueShare,
  type SpecialOfferConfig,
} from '@/lib/pricingModel'

export type EffectivePricingMode =
  | 'legacy'
  | 'competition_entry'
  | 'free'
  | 'monthly_group'
  | 'one_to_one'
  | 'special_offer'

export type SpecialOfferKey = 'english_abacus' | 'phonics'

/** Current billing period as YYYY-MM (UTC) — the unit a recurring monthly payment is tagged with. */
export function currentBillingPeriod(date: Date = new Date()): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function nextBillingPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const next = new Date(Date.UTC(y, m, 1)) // m is already 1-indexed month's 0-index next month
  return currentBillingPeriod(next)
}

export function resolveEffectivePricingMode(course: Pick<Course, 'pricing_mode' | 'is_competition' | 'is_free'>): EffectivePricingMode {
  if (course.pricing_mode === 'legacy') return 'legacy'
  if (course.pricing_mode === 'monthly_group') return 'monthly_group'
  if (course.pricing_mode === 'one_to_one') return 'one_to_one'
  if (course.pricing_mode === 'special_offer') return 'special_offer'

  // No explicit choice recorded — auto-classify instead of defaulting
  // to legacy. This is the actual fix for "must apply to ALL
  // applicable courses, not merely an optional mode."
  if (course.is_competition) return 'competition_entry'
  if (course.is_free) return 'free'
  return 'monthly_group'
}

export interface EffectiveCoursePricing {
  mode: EffectivePricingMode
  /** Amount due for the action being taken right now (one-time charge, or this month's instalment). */
  amount: number
  isRecurring: boolean
  /** YYYY-MM this charge covers, or null for a one-time charge. */
  billingPeriod: string | null
  batchSize: number | null
  revenueShare: RevenueShare
  offerKey: SpecialOfferKey | null
  /** The non-offer price, shown for comparison when a special offer applies. */
  regularAmount: number | null
}

/**
 * `specialOfferEligible` should come from a real (student-specific)
 * eligibility check (src/lib/specialOfferEligibility.ts) whenever one
 * is available. Left undefined it defaults to "assume eligible" —
 * appropriate for a first-time-visitor price display where no
 * eligibility record can exist yet; NEVER the final authority for
 * what a payment is allowed to charge (see firestore.rules
 * paymentMatchesCourse, which independently re-derives the accepted
 * amount(s) server-side).
 */
export function getEffectiveCoursePricing(
  course: Course,
  config: PricingConfig,
  opts?: { specialOfferEligible?: boolean }
): EffectiveCoursePricing {
  const mode = resolveEffectivePricingMode(course)
  const revenueShare = config.revenueShare

  if (mode === 'legacy' || mode === 'competition_entry') {
    const amount = Math.max(course.base_fee - course.discount_amount, 0)
    return { mode, amount, isRecurring: false, billingPeriod: null, batchSize: null, revenueShare, offerKey: null, regularAmount: null }
  }

  if (mode === 'free') {
    return { mode, amount: 0, isRecurring: false, billingPeriod: null, batchSize: null, revenueShare, offerKey: null, regularAmount: null }
  }

  if (mode === 'monthly_group') {
    const amount = course.monthly_fee_override ?? config.monthlyGroupFeePerStudent
    const batchSize = course.batch_size_override ?? config.groupBatchSize
    return { mode, amount, isRecurring: true, billingPeriod: currentBillingPeriod(), batchSize, revenueShare, offerKey: null, regularAmount: null }
  }

  if (mode === 'one_to_one') {
    const amount = course.monthly_fee_override ?? config.oneToOneMonthlyFee
    return { mode, amount, isRecurring: true, billingPeriod: currentBillingPeriod(), batchSize: null, revenueShare, offerKey: null, regularAmount: null }
  }

  // 'special_offer'
  const key: SpecialOfferKey = course.special_offer_key ?? 'phonics'
  const offer: SpecialOfferConfig = key === 'english_abacus' ? config.specialOffers.englishAbacus : config.specialOffers.phonics
  const eligible = opts?.specialOfferEligible ?? true
  const amount = offer.isActive && eligible ? offer.offerPrice : offer.regularPrice
  return {
    mode,
    amount,
    isRecurring: true,
    billingPeriod: currentBillingPeriod(),
    batchSize: null,
    revenueShare,
    offerKey: key,
    regularAmount: offer.regularPrice,
  }
}

export function computeSplitForPricing(pricing: EffectiveCoursePricing) {
  return computeRevenueSplit(pricing.amount, pricing.revenueShare)
}

/** Human label used on the course card/detail/checkout, e.g. "₹10,000/month · group (4/batch)". */
export function describePricing(pricing: EffectiveCoursePricing): string {
  const rupees = `₹${pricing.amount.toLocaleString('en-IN')}`
  switch (pricing.mode) {
    case 'legacy':
      return rupees
    case 'competition_entry':
      return `${rupees} entry fee`
    case 'free':
      return 'Free'
    case 'monthly_group':
      return `${rupees}/month${pricing.batchSize ? ` · group (${pricing.batchSize}/batch)` : ''}`
    case 'one_to_one':
      return `${rupees}/month · one-to-one`
    case 'special_offer':
      return pricing.regularAmount && pricing.regularAmount !== pricing.amount
        ? `${rupees}/month (offer, regular ₹${pricing.regularAmount.toLocaleString('en-IN')})`
        : `${rupees}/month`
  }
}
