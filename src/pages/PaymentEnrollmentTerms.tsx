import LegalPage, { PolicySection } from '@/components/LegalPage'

// Covers STUDENT/COURSE payment and enrollment only — tutor payment/fee
// processing is a separate, unrelated feature and is intentionally not
// referenced anywhere on this page.
export default function PaymentEnrollmentTerms() {
  return (
    <LegalPage
      title="Payment &amp; Enrollment Terms"
      intro="These terms cover student payment for, and enrollment into, VATTAMS ACADEMIA courses and competitions. They do not cover tutor payments, which are handled separately."
    >
      <PolicySection title="1. Course enrollment">
        <p>
          Enrollment into a paid course or competition begins once a student initiates payment for
          that course. An enrolment only becomes active after payment has been verified — starting
          the payment process does not, by itself, grant access to a course.
        </p>
      </PolicySection>

      <PolicySection title="2. Student payment">
        <p>
          Payment is collected via UPI: the student scans/opens a QR/collect link to pay the amount
          shown for the course, then submits the payment reference (UTR) through the platform so
          the payment can be matched and verified. VATTAMS ACADEMIA does not process card details
          or store payment credentials.
        </p>
      </PolicySection>

      <PolicySection title="3. Payment confirmation">
        <p>
          After a UTR reference is submitted, the payment is marked as awaiting verification. An
          admin manually verifies the payment against the amount and reference submitted. This is a
          manual process and is not instantaneous.
        </p>
      </PolicySection>

      <PolicySection title="4. Enrollment activation">
        <p>
          Once a payment is verified by an admin, the corresponding course enrolment is activated
          and becomes visible on the student&apos;s dashboard. Course access follows enrolment
          activation.
        </p>
      </PolicySection>

      <PolicySection title="5. Refunds and cancellation">
        <p>
          Refund and cancellation terms are set out in the{' '}
          <a href="/refund-policy" className="text-gold underline hover:text-gold-bright">
            Refund Policy
          </a>
          , which governs any payment made through VATTAMS ACADEMIA. If a submitted payment is
          rejected during verification, no enrolment is created for that payment.
        </p>
      </PolicySection>

      <PolicySection title="6. Failed or pending payments">
        <p>
          A payment remains in a pending or submitted state until an admin reviews it. If a
          payment cannot be verified, the enrolment is not activated. Students should check their
          dashboard for the current status of a payment before assuming it has failed.
        </p>
      </PolicySection>

      <PolicySection title="7. Course access">
        <p>
          Course access is tied to an active, verified enrolment for the specific course paid for.
          Access may be reviewed or paused if a payment is later found to be invalid, disputed, or
          fraudulent.
        </p>
      </PolicySection>

      <PolicySection title="8. Incorrect payment information">
        <p>
          A student is responsible for submitting an accurate UTR/payment reference for their own
          payment. If an incorrect reference is submitted, verification may be delayed or the
          payment may not be matched — students should contact support with the correct reference
          for review.
        </p>
      </PolicySection>

      <PolicySection title="9. Platform responsibility and limitations">
        <p>
          VATTAMS ACADEMIA verifies payments manually and makes reasonable efforts to do so
          promptly, but is not responsible for delays caused by third-party payment apps, banks,
          or network issues outside its control, or for amounts sent to an incorrect UPI ID by
          mistake. For any payment issue, contact support through the{' '}
          <a href="/contact" className="text-gold underline hover:text-gold-bright">
            Contact
          </a>{' '}
          page with your payment reference.
        </p>
      </PolicySection>
    </LegalPage>
  )
}
