import { Link } from 'react-router-dom'
import type { Course } from '@/types/database'

export default function CourseCard({ course }: { course: Course }) {
  const finalPrice = Math.max(course.base_fee - course.discount_amount, 0)

  return (
    <Link to={`/courses/${course.slug}`} className="card group flex flex-col overflow-hidden">
      <div className="aspect-[16/9] w-full bg-navy-light">
        {course.cover_image_url ? (
          <img
            src={course.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-muted">
            <span className="font-display text-sm">VATTAMS ACADEMIA</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {course.level && (
          <span className="w-fit rounded-full border border-gold/30 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gold">
            {course.level}
          </span>
        )}
        <h3 className="font-display text-lg leading-snug">{course.name}</h3>
        {course.short_description && (
          <p className="line-clamp-2 text-sm text-slate-muted">{course.short_description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-semibold text-parchment">
            {course.is_free ? 'Free' : `₹${finalPrice.toLocaleString('en-IN')}`}
          </span>
          {course.discount_amount > 0 && !course.is_free && (
            <span className="text-xs text-slate-muted line-through">₹{course.base_fee.toLocaleString('en-IN')}</span>
          )}
        </div>
        <span className="mt-3 flex w-fit items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gold group-hover:text-gold-bright">
          View Course →
        </span>
      </div>
    </Link>
  )
}