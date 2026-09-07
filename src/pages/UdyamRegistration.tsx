import LegalPage from '@/components/LegalPage'

export default function UdyamRegistration() {
  return (
    <LegalPage
      title="Udyam Registration"
      eyebrow="Business Registration"
      intro="VATTAMS ACADEMIA is a registered micro enterprise under the Udyam Registration system."
    >
      <section>
        <h2 className="font-display text-lg text-gold-bright">VATTAMS ACADEMIA</h2>
        <p className="mt-2">
          Our Udyam Registration Certificate is provided here for business
          verification and transparency.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg text-gold-bright">Udyam Certificate</h2>
        <p className="mt-2">
          You can view the official certificate issued through the Government
          of India Udyam Registration system.
        </p>

        <a
          href="/documents/VATTAMS-Academia-Udyam-Certificate.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex rounded-lg border border-gold/40 px-4 py-2 font-semibold text-gold hover:border-gold hover:text-gold-bright"
        >
          View Udyam Certificate
        </a>
      </section>
    </LegalPage>
  )
}
