import LegalPage, { PolicySection } from '@/components/LegalPage'

export default function CertificateCompetitionTerms() {
  return (
    <LegalPage
      title="Certificate / Competition Terms"
      intro="These terms cover certificates issued by VATTAMS ACADEMIA and participation in VATTAMS ACADEMIA competitions."
    >
      <PolicySection title="1. Certificate eligibility">
        <p>
          Certificates are issued at VATTAMS ACADEMIA&apos;s discretion to students who meet the
          relevant requirement for the certificate type — such as course completion, competition
          participation, a specific achievement, or an assessment result.
        </p>
      </PolicySection>

      <PolicySection title="2. Completion requirements">
        <p>
          Where a certificate is tied to a course, it is issued only once the course requirement
          it represents has genuinely been met. Enrolling in a course does not, by itself,
          guarantee a certificate.
        </p>
      </PolicySection>

      <PolicySection title="3. Certificate issuance">
        <p>
          Certificates are issued by the VATTAMS ACADEMIA admin team, each with a unique
          certificate code, the student&apos;s name, and, where relevant, a course name and score.
          A certificate may be marked invalid/revoked by an admin if it was issued in error or
          later found to involve misconduct.
        </p>
      </PolicySection>

      <PolicySection title="4. Name and details accuracy">
        <p>
          A certificate is issued using the student&apos;s name and details as they appear in their
          VATTAMS ACADEMIA account. Students are responsible for keeping their registered details
          accurate; VATTAMS ACADEMIA is not responsible for errors caused by inaccurate account
          information.
        </p>
      </PolicySection>

      <PolicySection title="5. Certificate verification">
        <p>
          Any certificate issued by VATTAMS ACADEMIA can be verified using its certificate code on
          the{' '}
          <a href="/verify-certificate" className="text-gold underline hover:text-gold-bright">
            Verify Certificate
          </a>{' '}
          page. A certificate that cannot be verified there, or that shows as invalid/revoked,
          should not be treated as a valid VATTAMS ACADEMIA credential.
        </p>
      </PolicySection>

      <PolicySection title="6. Competition eligibility">
        <p>
          Competitions are listed on the{' '}
          <a href="/competitions" className="text-gold underline hover:text-gold-bright">
            Competitions
          </a>{' '}
          page with their own description and pricing, as published by VATTAMS ACADEMIA at the
          time. Eligibility for a specific competition is as stated on that competition&apos;s
          listing.
        </p>
      </PolicySection>

      <PolicySection title="7. Competition registration">
        <p>
          Registering for a paid competition follows the same enrollment and payment process as a
          course (see{' '}
          <a href="/payment-enrollment-terms" className="text-gold underline hover:text-gold-bright">
            Payment &amp; Enrollment Terms
          </a>
          ). A place in a competition is only confirmed once payment is verified.
        </p>
      </PolicySection>

      <PolicySection title="8. Competition rules">
        <p>
          Participants must follow any rules and instructions published for a specific competition
          and must compete honestly and independently, without assistance that the competition
          rules do not permit.
        </p>
      </PolicySection>

      <PolicySection title="9. Disqualification">
        <p>
          VATTAMS ACADEMIA may disqualify a participant from a competition, and may revoke an
          associated certificate, for misconduct, dishonesty, or violation of the competition&apos;s
          rules or VATTAMS ACADEMIA&apos;s policies.
        </p>
      </PolicySection>

      <PolicySection title="10. Results and award decisions">
        <p>
          Results, rankings, and award decisions for a competition are determined by VATTAMS
          ACADEMIA and are final, except where a genuine error is identified and corrected by the
          admin team.
        </p>
      </PolicySection>

      <PolicySection title="11. Use of certificates and credentials">
        <p>
          A VATTAMS ACADEMIA certificate or competition credential may be used by the student to
          represent their own achievement. It must not be altered, falsified, transferred to
          another person, or used in any misleading way.
        </p>
      </PolicySection>
    </LegalPage>
  )
}
