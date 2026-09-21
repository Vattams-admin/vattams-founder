import type { Course } from '@/types/database'
import type { PricingConfig } from '@/lib/pricingModel'

export function getBogoRegularPrice(
  course: Course,
  config: PricingConfig,
): number {
  if (course.is_free) return 0

  if (course.is_competition) {
    const key = course.category_id
      ? `${course.category_id}:${course.name}`
      : null

    const plan = key ? config.catalogCourses.plans[key] : undefined

    if (plan) return plan.regularPrice

    return Math.max(course.base_fee, 0)
  }

  if (course.pricing_mode === 'special_offer') {
    const key = course.special_offer_key ?? 'phonics'
    const offer =
      key === 'english_abacus'
        ? config.specialOffers.englishAbacus
        : config.specialOffers.phonics

    return Math.max(offer.regularPrice, 0)
  }

  if (course.pricing_mode === 'school_tuition') {
    const board = course.tuition_board
    const session = course.tuition_session
    const classBand = course.tuition_class_band

    if (board && session && classBand) {
      const planKey = `${board}_${session}_${classBand}`
      const plan = config.schoolTuition.plans[planKey]

      if (plan) return Math.max(plan.regularPrice, 0)
    }
  }

  if (course.pricing_mode === 'one_to_one') {
    return Math.max(
      course.monthly_fee_override ?? config.oneToOneMonthlyFee,
      0,
    )
  }

  if (course.pricing_mode === 'monthly_group') {
    return Math.max(
      course.monthly_fee_override ?? config.monthlyGroupFeePerStudent,
      0,
    )
  }

  if (course.pricing_mode === 'legacy') {
    return Math.max(course.base_fee, 0)
  }

  return Math.max(
    course.monthly_fee_override ?? config.monthlyGroupFeePerStudent,
    0,
  )
}

export function isBogoTargetEligible(
  purchasedCourse: Course,
  targetCourse: Course,
  config: PricingConfig,
): boolean {
  if (!targetCourse.is_published) return false
  if (targetCourse.is_free) return false
  if (purchasedCourse.id === targetCourse.id) return false

  const purchasedRegularPrice = getBogoRegularPrice(
    purchasedCourse,
    config,
  )

  const targetRegularPrice = getBogoRegularPrice(
    targetCourse,
    config,
  )

  return (
    purchasedRegularPrice > 0 &&
    targetRegularPrice > 0 &&
    targetRegularPrice <= purchasedRegularPrice
  )
}
