import LegalPage, { PolicySection } from '@/components/LegalPage'

export default function TutorVerificationPolicy() {
  return (
    <LegalPage
      title="Tutor Verification Policy"
      intro="This policy explains how VATTAMS ACADEMIA reviews and verifies tutor applications before a tutor is approved to teach on the platform."
    >
      <PolicySection title="1. Application process">
        <p>
          Anyone wishing to teach on VATTAMS ACADEMIA must submit a tutor application through the
          official tutor registration form, providing their name, contact details, qualification,
          area of expertise, and a short introduction. An application does not grant access to
          teach — every application enters a <strong>pending approval</strong> status and is
          reviewed by the VATTAMS ACADEMIA admin team before any access is granted.
        </p>
      </PolicySection>

      <PolicySection title="2. Identity verification">
        <p>
          Applicants are expected to register using their genuine name, a contact email they
          control, and accurate personal details. VATTAMS ACADEMIA may request additional proof of
          identity at any stage of the application or after approval, and may pause or reject an
          application if identity cannot be reasonably confirmed.
        </p>
      </PolicySection>

      <PolicySection title="3. Qualification verification">
        <p>
          The qualification and subject expertise declared at registration are reviewed by the
          admin team as part of the approval decision. VATTAMS ACADEMIA may ask an applicant to
          provide evidence of a declared qualification (such as a certificate, degree, or transcript)
          before or after approval, and reserves the right to decline or withdraw approval where
          a declared qualification cannot be reasonably supported.
        </p>
      </PolicySection>

      <PolicySection title="4. Experience verification">
        <p>
          Where an applicant references teaching or subject-matter experience, the admin team may
          seek reasonable clarification or supporting information about that experience as part of
          its review. Experience claims that cannot be reasonably supported may affect the outcome
          of an application.
        </p>
      </PolicySection>

      <PolicySection title="5. Document verification">
        <p>
          VATTAMS ACADEMIA may request supporting documents (for example, identity proof,
          qualification certificates, or other relevant records) from an applicant or approved
          tutor at any time as part of ongoing verification. Failure to provide requested documents
          within a reasonable time may result in an application being rejected, or an existing
          approval being suspended, pending resolution.
        </p>
      </PolicySection>

      <PolicySection title="6. Background and safety verification">
        <p>
          Because tutors may interact directly with students, including minors, VATTAMS ACADEMIA
          takes safety seriously and reserves the right to carry out reasonable background and
          safety checks appropriate to the role, and to decline or withdraw approval on safety
          grounds. Tutors must disclose anything materially relevant to student safety if asked.
        </p>
      </PolicySection>

      <PolicySection title="7. Approval / rejection process">
        <p>
          Every application is reviewed individually by the admin team. An application may be{' '}
          <strong>approved</strong> or <strong>rejected</strong>; a rejected application is recorded
          with a reason, which the applicant may be shown so they understand the outcome. Approval
          is at VATTAMS ACADEMIA&apos;s discretion and is not guaranteed by submitting an
          application.
        </p>
      </PolicySection>

      <PolicySection title="8. Responsibility for truthful information">
        <p>
          Applicants and tutors are solely responsible for the accuracy and truthfulness of all
          information they provide — including identity, qualification, expertise, and experience
          details. Providing false, misleading, or impersonated information is a serious violation
          of this policy and may result in immediate rejection or removal from the platform.
        </p>
      </PolicySection>

      <PolicySection title="9. Re-verification and updates">
        <p>
          A tutor who materially changes their qualification, subject expertise, or contact details
          should keep their profile accurate. VATTAMS ACADEMIA may periodically re-review approved
          tutor profiles and may request updated information or documents as part of that review.
        </p>
      </PolicySection>

      <PolicySection title="10. Suspension and rejection">
        <p>
          VATTAMS ACADEMIA reserves the right to suspend, reject, or withdraw a tutor&apos;s
          verification and platform access at any time where there is reasonable concern about the
          accuracy of information provided, student safety, conduct (see the Tutor Code of
          Conduct), or compliance with this policy.
        </p>
      </PolicySection>
    </LegalPage>
  )
}
