        </Section>
        <Section title="Learning Philosophy">
          Fundamentals first, then repetition under realistic conditions. Every programme pairs study
          material with timed practice so preparation reflects the actual exam experience.
        </Section>
        <Section title="Certification">
          Every certificate issued by VATTAMS ACADEMIA carries a unique certificate number that can be
          checked instantly on our{' '}
          <Link to="/verify-certificate" className="text-gold hover:text-gold-bright">
            public verification page
          </Link>
          .
        </Section>
        <Section title="Future Vision">
          To keep expanding our exam and course catalogue while holding the same standard: real
          content, honest data, and certification that means something.
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="font-display text-lg text-gold-bright">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-parchment/90">{children}</p>
    </div>
  )
}