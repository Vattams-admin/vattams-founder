import LegalPage from '@/components/LegalPage'

export default function RefundPolicy() {
  return (
    <LegalPage noindex title="Refund Policy">
      <p>
        Payments are verified manually after UTR submission. If a payment is rejected during
        verification, no enrolment is created and the amount is not collected further; for UPI
        payments that were mistakenly sent, contact support with your UTR reference for review.
      </p>
      <p>
        This page is a placeholder pending final policy sign-off — replace with your organisation&apos;s
        complete refund terms before public launch.
      </p>
    </LegalPage>
  )
}