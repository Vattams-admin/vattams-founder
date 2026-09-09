// src/lib/pricingConfig.ts
//
// Admin-configurable storage for the pricing/revenue-share model
// defined in src/lib/pricingModel.ts. Lives at the single Firestore
// doc `settings/pricing` — deliberately a doc, not a collection,
// since there is exactly one active pricing config at a time (same
// pattern as any other app-wide settings singleton).
//
// Nothing here is hardcoded in more than one place: every screen that
// needs the current percentages, fees, batch size, or offer terms
// reads through getPricingConfig() / subscribePricingConfig(), and
// every admin edit goes through savePricingConfig(). If the doc
// doesn't exist yet (first run after this feature ships), reads fall
// back to DEFAULT_PRICING_CONFIG in memory — nothing breaks — and the
// admin Pricing Settings screen persists it on first save.

import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { DEFAULT_PRICING_CONFIG, isValidRevenueShare, type PricingConfig } from '@/lib/pricingModel'

const PRICING_DOC_PATH = ['settings', 'pricing'] as const

function pricingDocRef() {
  return doc(firestore, ...PRICING_DOC_PATH)
}

/**
 * Merges a possibly-partial Firestore doc (e.g. an older config saved
 * before a new field existed) on top of the defaults, so a missing
 * field never crashes a reader — it just falls back silently.
 */
function mergeWithDefaults(data: Partial<PricingConfig> | undefined): PricingConfig {
  if (!data) return DEFAULT_PRICING_CONFIG
  return {
    monthlyGroupFeePerStudent: data.monthlyGroupFeePerStudent ?? DEFAULT_PRICING_CONFIG.monthlyGroupFeePerStudent,
    groupBatchSize: data.groupBatchSize ?? DEFAULT_PRICING_CONFIG.groupBatchSize,
    oneToOneMonthlyFee: data.oneToOneMonthlyFee ?? DEFAULT_PRICING_CONFIG.oneToOneMonthlyFee,
    revenueShare: data.revenueShare ?? DEFAULT_PRICING_CONFIG.revenueShare,
    specialOffers: {
      englishAbacus: {
        ...DEFAULT_PRICING_CONFIG.specialOffers.englishAbacus,
        ...(data.specialOffers?.englishAbacus ?? {}),
      },
      phonics: {
        ...DEFAULT_PRICING_CONFIG.specialOffers.phonics,
        ...(data.specialOffers?.phonics ?? {}),
      },
    },
      schoolTuition: {
        ...DEFAULT_PRICING_CONFIG.schoolTuition,
        ...(data.schoolTuition ?? {}),
        plans: {
          ...DEFAULT_PRICING_CONFIG.schoolTuition.plans,
          ...(data.schoolTuition?.plans ?? {}),
        },
      },
      catalogCourses: {
        ...DEFAULT_PRICING_CONFIG.catalogCourses,
        ...(data.catalogCourses ?? {}),
        plans: {
          ...DEFAULT_PRICING_CONFIG.catalogCourses.plans,
          ...(data.catalogCourses?.plans ?? {}),
        },
      },
  }
}

/** One-off read — used wherever a single current value is needed (e.g. computing a price at checkout time). */
export async function getPricingConfig(): Promise<PricingConfig> {
  const snap = await getDoc(pricingDocRef())
  return mergeWithDefaults(snap.exists() ? (snap.data() as Partial<PricingConfig>) : undefined)
}

/** Live subscription — used by the admin Pricing Settings screen so edits from another tab/admin show up immediately. */
export function subscribePricingConfig(
  onChange: (config: PricingConfig) => void,
  onError?: (error: unknown) => void
): () => void {
  return onSnapshot(
    pricingDocRef(),
    (snap) => onChange(mergeWithDefaults(snap.exists() ? (snap.data() as Partial<PricingConfig>) : undefined)),
    (err) => onError?.(err)
  )
}

/**
 * Admin-only write. Always writes the full config object (not a
 * partial merge) so the doc is never left in a half-updated shape;
 * callers should start from a value obtained via getPricingConfig()/
 * subscribePricingConfig(), edit it, and pass the whole thing back.
 * Rejects an invalid revenue share (must sum to 100%) before writing
 * anything, so a typo in the admin form can't silently misallocate
 * every future payment split.
 */
export async function savePricingConfig(config: PricingConfig): Promise<void> {
  if (!isValidRevenueShare(config.revenueShare)) {
    throw new Error('Revenue share percentages must add up to 100%.')
  }
  await setDoc(pricingDocRef(), config)
}
