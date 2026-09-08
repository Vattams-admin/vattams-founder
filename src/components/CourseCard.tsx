import { Link } from 'react-router-dom'
import type { Course } from '@/types/database'
import { getCourseDisplayName } from '@/lib/courseDisplay'
import { getCategoryLabel } from '@/lib/catalog'
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from '@/lib/pricingModel'
import { getEffectiveCoursePricing, describePricing } from '@/lib/coursePricing'

const FALLBACK_THEMES = [
  {
    gradient: 'linear-gradient(135deg,#172554 0%,#2563eb 52%,#06b6d4 100%)',
    glow: 'rgba(34,211,238,.32)',
  },
  {
    gradient: 'linear-gradient(135deg,#312e81 0%,#4f46e5 48%,#a855f7 100%)',
    glow: 'rgba(168,85,247,.30)',
  },
  {
    gradient: 'linear-gradient(135deg,#0f3b4a 0%,#0e7490 48%,#14b8a6 100%)',
    glow: 'rgba(20,184,166,.30)',
  },
]

function fallbackIndex(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return hash % FALLBACK_THEMES.length
}

export default function CourseCard({ course, pricingConfig }: { course: Course; pricingConfig?: PricingConfig }) {
  // Falls back to the in-memory defaults when the caller hasn't fetched
  // settings/pricing yet — keeps this component usable standalone (it
  // never fetches network data itself) while still reflecting the
  // approved monthly model instead of a stale base_fee for every course
  // that doesn't opt out of it. See src/lib/coursePricing.ts.
  const pricing = getEffectiveCoursePricing(course, pricingConfig ?? DEFAULT_PRICING_CONFIG)
  const displayName = getCourseDisplayName(course.name)
  const categoryLabel = getCategoryLabel(course.category_id)
  const theme = FALLBACK_THEMES[fallbackIndex(course.slug || displayName)]

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')

  return (
    <Link
      to={`/courses/${course.slug}`}
      className="course-card group block overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.045] shadow-[0_18px_50px_rgba(0,0,0,.22)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-2 hover:border-white/20 hover:shadow-[0_24px_70px_rgba(0,0,0,.34)]"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {course.cover_image_url ? (
          <img
            src={course.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
        ) : (
          <div
            className="relative flex h-full w-full items-center justify-center overflow-hidden"
            style={{ background: theme.gradient }}
          >
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-black/20 blur-3xl" />

            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.12) 1px,transparent 1px)',
                backgroundSize: '28px 28px',
              }}
            />

            <span className="relative text-5xl font-black tracking-[-0.06em] text-white/90 drop-shadow-2xl sm:text-6xl">
              {initials || 'VA'}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

        {course.is_featured && (
          <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur-md">
            Featured
          </span>
        )}

        <span className="absolute bottom-4 right-4 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md">
          {course.is_free ? 'FREE' : 'COURSE'}
        </span>
      </div>

      <div className="flex min-h-[205px] flex-col p-5 sm:p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {categoryLabel && (
            <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-cyan-100/80">
              {categoryLabel}
            </span>
          )}

          {course.level && (
            <span className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] font-semibold text-white/60">
              {course.level}
            </span>
          )}
        </div>

        <h3 className="mb-2 font-body text-[19px] font-bold leading-[1.2] tracking-[-0.02em] text-white transition-colors duration-200 group-hover:text-cyan-100">
          {displayName}
        </h3>

        {course.short_description && (
          <p className="line-clamp-2 text-[13px] leading-5 text-white/55">
            {course.short_description}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[21px] font-extrabold tracking-[-0.02em] text-white">
                {pricing.mode === 'free' ? 'Free' : describePricing(pricing)}
              </span>

              {pricing.mode === 'special_offer' && pricing.regularAmount != null && pricing.regularAmount !== pricing.amount && (
                <span className="text-xs text-white/35 line-through">
                  ₹{pricing.regularAmount.toLocaleString('en-IN')}
                </span>
              )}
              {(pricing.mode === 'legacy' || pricing.mode === 'competition_entry') && course.discount_amount > 0 && (
                <span className="text-xs text-white/35 line-through">
                  ₹{course.base_fee.toLocaleString('en-IN')}
                </span>
              )}
            </div>

            {course.duration_text && (
              <span className="mt-1 block text-[11px] text-white/40">
                {course.duration_text}
              </span>
            )}
          </div>

          <span className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-extrabold uppercase tracking-[0.08em] text-slate-950 transition-all duration-200 group-hover:bg-cyan-100 group-hover:gap-3">
            Explore
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}
