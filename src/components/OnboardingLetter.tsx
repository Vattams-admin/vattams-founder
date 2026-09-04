// Shared letter used both as the Tutor Onboarding Letter (spec §4) and
// the Student Onboarding/Welcome Letter (spec §9). Deliberately makes no
// claims about employment terms, salary, benefits, contracts, course
// enrolment, payment, or certification — only what onboarding.ts/the
// existing registration data actually records.

export interface OnboardingLetterProps {
  role: 'Tutor' | 'Student'
  name: string
  code: string
  permanentId: string
  status: string
  issuedAt: string
  subtitle?: string | null // subject/expertise for tutors, enrolled course for students, if available
}

export default function OnboardingLetter({ role, name, code, permanentId, status, issuedAt, subtitle }: OnboardingLetterProps) {
  const today = new Date(issuedAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="mx-auto max-w-2xl print:max-w-none">
      <div className="card p-8 sm:p-10">
        <div className="flex items-center gap-3 border-b border-gold/20 pb-6">
          <img src="/branding/logo.png" alt="" className="h-12 w-12 object-contain" />
          <div>
            <p className="font-display text-lg uppercase tracking-[0.2em] text-gold">VATTAMS ACADEMIA</p>
            <p className="text-xs text-slate-muted">academia.vattams.net</p>
          </div>
        </div>

        <p className="mt-6 text-sm text-slate-muted">{today}</p>

        <h1 className="mt-4 font-display text-2xl">
          {role === 'Tutor' ? 'Tutor Onboarding Letter' : 'Student Onboarding & Welcome Letter'}
        </h1>

        <p className="mt-6 text-sm leading-relaxed">Dear {name},</p>

        <p className="mt-3 text-sm leading-relaxed">
          {role === 'Tutor' ? (
            <>
              This letter confirms that you have been successfully onboarded to VATTAMS ACADEMIA as a{' '}
              <strong>Tutor</strong>{subtitle ? <> for <strong>{subtitle}</strong></> : null}. Your application was reviewed and
              approved, and your permanent identity records have now been issued.
            </>
          ) : (
            <>
              Welcome to VATTAMS ACADEMIA. This letter confirms that you have been successfully onboarded as a{' '}
              <strong>Student</strong>{subtitle ? <>, currently enrolled in <strong>{subtitle}</strong></> : null}. Your
              application was reviewed and approved, and your permanent identity records have now been issued.
            </>
          )}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-card border border-white/10 p-5 text-sm">
          <dt className="text-slate-muted">Name</dt>
          <dd className="text-right font-medium">{name}</dd>
          <dt className="text-slate-muted">{role === 'Tutor' ? 'Employee Code' : 'Student Code'}</dt>
          <dd className="text-right font-medium">{code}</dd>
          <dt className="text-slate-muted">{role} ID</dt>
          <dd className="text-right font-medium">{permanentId}</dd>
          <dt className="text-slate-muted">Role / Designation</dt>
          <dd className="text-right">{role}</dd>
          <dt className="text-slate-muted">Onboarding Status</dt>
          <dd className="text-right">
            <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-success">
              {status}
            </span>
          </dd>
        </dl>

        <p className="mt-6 text-sm leading-relaxed text-slate-muted">
          This letter is an official acknowledgement of onboarding to VATTAMS ACADEMIA and does not itself constitute an
          employment contract, offer of compensation, or certification.
        </p>

        <p className="mt-8 text-sm">
          Warm regards,
          <br />
          <span className="font-display text-gold-bright">VATTAMS ACADEMIA</span>
        </p>
      </div>

      <div className="mt-4 print:hidden">
        <button onClick={() => window.print()} className="btn-secondary w-full">
          Print / Download as PDF
        </button>
      </div>
    </div>
  )
}
