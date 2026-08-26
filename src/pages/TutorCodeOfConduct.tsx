import LegalPage, { PolicySection } from '@/components/LegalPage'

export default function TutorCodeOfConduct() {
  return (
    <LegalPage
      title="Tutor Code of Conduct"
      intro="Every tutor approved to teach on VATTAMS ACADEMIA is expected to follow this code of conduct at all times."
    >
      <PolicySection title="1. Professional behaviour">
        <p>
          Tutors must conduct themselves professionally in every interaction with students,
          parents, other tutors, and VATTAMS ACADEMIA staff — including in course content,
          messages, and any live or recorded session.
        </p>
      </PolicySection>

      <PolicySection title="2. Respectful communication">
        <p>
          All communication must be respectful and constructive. Rude, dismissive, threatening, or
          demeaning language toward a student, parent, or colleague is not acceptable under any
          circumstance.
        </p>
      </PolicySection>

      <PolicySection title="3. Student safety">
        <p>
          Tutors must prioritise student safety and wellbeing at all times, and must never place a
          student in a situation that compromises their physical, emotional, or digital safety.
          Any safety concern involving a student must be reported to VATTAMS ACADEMIA immediately.
        </p>
      </PolicySection>

      <PolicySection title="4. Appropriate tutor / student interaction">
        <p>
          Interaction with students must stay strictly professional and education-focused, and
          should take place through the channels VATTAMS ACADEMIA provides. Tutors must not
          pursue personal relationships with students, request to communicate outside official
          channels, or engage in any conduct that blurs the tutor/student boundary.
        </p>
      </PolicySection>

      <PolicySection title="5. No harassment or discrimination">
        <p>
          Harassment, bullying, discrimination, or unequal treatment of any student or colleague —
          on any basis — is strictly prohibited and will result in disciplinary action, up to and
          including removal from the platform.
        </p>
      </PolicySection>

      <PolicySection title="6. No misuse of student information">
        <p>
          Any information a tutor has access to about a student — name, contact details, academic
          record, or otherwise — may only be used for the purpose of teaching that student on
          VATTAMS ACADEMIA. It must never be used for personal, commercial, or any other purpose.
        </p>
      </PolicySection>

      <PolicySection title="7. No unauthorised collection or use of personal data">
        <p>
          Tutors must not collect personal data from students or parents beyond what is genuinely
          needed for teaching, and must never request sensitive personal information, payment
          details, or account credentials outside VATTAMS ACADEMIA&apos;s official flows.
        </p>
      </PolicySection>

      <PolicySection title="8. Academic integrity">
        <p>
          Tutors must teach honestly and accurately, represent their own qualifications and
          expertise truthfully, and must not assist in or facilitate any form of academic
          dishonesty, including exam or competition misconduct.
        </p>
      </PolicySection>

      <PolicySection title="9. Punctuality and class responsibility">
        <p>
          Tutors are expected to be reliable and punctual for any class, session, or commitment
          they have taken on, and to communicate proactively if a genuine conflict arises rather
          than leaving students or VATTAMS ACADEMIA without notice.
        </p>
      </PolicySection>

      <PolicySection title="10. Reporting concerns">
        <p>
          Tutors who witness or become aware of a safety concern, a conduct violation, or any
          issue affecting a student should report it to VATTAMS ACADEMIA through Contact as soon
          as possible.
        </p>
      </PolicySection>

      <PolicySection title="11. Consequences for violations">
        <p>
          A violation of this code of conduct may result in a warning, temporary suspension, or
          permanent removal from VATTAMS ACADEMIA, at VATTAMS ACADEMIA&apos;s discretion, depending
          on the nature and severity of the violation. Serious violations, particularly those
          involving student safety, may be actioned immediately without prior warning.
        </p>
      </PolicySection>
    </LegalPage>
  )
}
