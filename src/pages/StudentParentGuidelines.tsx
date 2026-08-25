import LegalPage, { PolicySection } from '@/components/LegalPage'

export default function StudentParentGuidelines() {
  return (
    <LegalPage
      title="Student / Parent Guidelines"
      intro="These guidelines help students, parents, and guardians get the most out of VATTAMS ACADEMIA safely and respectfully."
    >
      <PolicySection title="1. Student registration">
        <p>
          A student account is created through the official student registration form, using
          accurate name and contact details. Where a student is a minor, a parent or guardian
          should be involved in registration and in overseeing the account.
        </p>
      </PolicySection>

      <PolicySection title="2. Parent / guardian responsibilities">
        <p>
          Parents and guardians of minor students are responsible for supervising their child&apos;s
          use of the platform, keeping account login details secure, reviewing enrolments and
          payments made on the account, and being reachable for communication from VATTAMS
          ACADEMIA where needed.
        </p>
      </PolicySection>

      <PolicySection title="3. Tutor communication">
        <p>
          Communication with tutors should stay professional, on-topic, and respectful, and should
          take place through the channels VATTAMS ACADEMIA provides. Students and parents should
          not share unnecessary personal information with a tutor, and should report any
          communication that feels inappropriate or unprofessional immediately (see &ldquo;Reporting
          problems&rdquo; below).
        </p>
      </PolicySection>

      <PolicySection title="4. Class attendance">
        <p>
          Students are expected to engage with their enrolled courses consistently and to make
          reasonable efforts to attend or complete scheduled learning activities where applicable.
          Regular engagement is the student&apos;s and, for minors, the parent/guardian&apos;s
          responsibility.
        </p>
      </PolicySection>

      <PolicySection title="5. Behaviour and respectful communication">
        <p>
          Students are expected to behave respectfully toward tutors, staff, and other students at
          all times. Harassment, abusive language, discrimination, or disruptive behaviour is not
          acceptable and may result in a warning, suspension, or removal from the platform.
        </p>
      </PolicySection>

      <PolicySection title="6. Learning materials">
        <p>
          Course materials provided through VATTAMS ACADEMIA are for the enrolled student&apos;s own
          personal learning use. They should not be copied, redistributed, resold, or shared
          outside the platform without permission.
        </p>
      </PolicySection>

      <PolicySection title="7. Safety">
        <p>
          Student safety is a priority. Students and parents should never be asked to share
          passwords, payment details outside the official payment flow, or personal information
          unrelated to learning. Any request or behaviour that raises a safety concern should be
          reported immediately.
        </p>
      </PolicySection>

      <PolicySection title="8. Privacy">
        <p>
          Personal information provided during registration and enrolment is used to operate
          accounts, courses, payments, and certificates, as described in the{' '}
          <a href="/privacy-policy" className="text-gold underline hover:text-gold-bright">
            Privacy Policy
          </a>
          . Students and parents should only share the information the platform actually asks for.
        </p>
      </PolicySection>

      <PolicySection title="9. Cancellation and rescheduling">
        <p>
          Cancellation, rescheduling, and refund matters for a paid enrolment are handled under the{' '}
          <a href="/refund-policy" className="text-gold underline hover:text-gold-bright">
            Refund Policy
          </a>{' '}
          and the{' '}
          <a href="/payment-enrollment-terms" className="text-gold underline hover:text-gold-bright">
            Payment &amp; Enrollment Terms
          </a>
          . Students and parents should reach out through Contact for any specific request.
        </p>
      </PolicySection>

      <PolicySection title="10. Reporting problems">
        <p>
          Any concern — about a tutor, another student, a payment, a certificate, or the platform
          itself — should be reported through the{' '}
          <a href="/contact" className="text-gold underline hover:text-gold-bright">
            Contact
          </a>{' '}
          page as soon as possible. VATTAMS ACADEMIA takes reported concerns seriously and will
          look into them.
        </p>
      </PolicySection>

      <PolicySection title="11. Appropriate use of the platform">
        <p>
          The platform must be used only for genuine learning, exam preparation, and competition
          purposes. Creating fake accounts, attempting to access another person&apos;s account,
          circumventing payment for a course, or misusing certificates is not permitted and may
          result in account suspension.
        </p>
      </PolicySection>
    </LegalPage>
  )
}
