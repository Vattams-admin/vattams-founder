export default function Contact() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Contact</p>
      <h1 className="mt-3 font-display text-3xl">Get in touch</h1>
      <p className="mt-4 text-parchment/90">
        Questions about a course, an exam programme, a payment, or a certificate? Reach out and we&apos;ll
        get back to you.
      </p>

      <div className="card mt-8 p-6">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gold">Support</dt>
            <dd className="mt-1 text-parchment/90">Use the contact details published on your VATTAMS ACADEMIA account or enrolment confirmation.</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gold">Payments</dt>
            <dd className="mt-1 text-parchment/90">For a payment that&apos;s pending verification, check your dashboard first — most are verified within one business day.</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gold">Certificates</dt>
            <dd className="mt-1 text-parchment/90">Verify any certificate instantly on the Verify Certificate page — no account needed.</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}