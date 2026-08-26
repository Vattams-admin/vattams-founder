// Reads the approved VATTAMS ACADEMIA WhatsApp number from an env var —
// intentionally separate from any calling/mobile number used elsewhere,
// and never hardcoded here, same pattern as VITE_UPI_VPA in Payment.tsx.
// No number is configured anywhere in this codebase today, so until
// VITE_WHATSAPP_NUMBER is set in the deployment environment, this
// renders nothing rather than a dead/fake link — same "honest
// placeholder" approach as Competitions.tsx and the UPI QR fallback.
const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.replace(
  /[^\d]/g,
  ''
)

const DEFAULT_MESSAGE =
  "Hi VATTAMS ACADEMIA, I'd like to know more about your courses."

export default function WhatsAppButton({
  message = DEFAULT_MESSAGE,
  className = ''
}: {
  message?: string
  className?: string
}) {
  if (!WHATSAPP_NUMBER) return null

  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with VATTAMS ACADEMIA on WhatsApp"
      className={`inline-flex items-center gap-2 rounded-card bg-[#25D366] px-4 py-2 text-sm font-semibold text-ink transition-opacity hover:opacity-90 ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M17.5 14.4c-.3-.1-1.7-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a7.7 7.7 0 0 1-2.3-1.4 8.6 8.6 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.4-.5.2-.3a.5.5 0 0 0 0-.5c-.1-.1-.7-1.7-1-2.3s-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 6 6 0 0 0 1.2 3.1 13.6 13.6 0 0 0 5.3 4.7c.7.3 1.3.5 1.8.6a3.9 3.9 0 0 0 1.9 0 3.1 3.1 0 0 0 2-1.4 2.6 2.6 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3z" />
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" />
      </svg>
      WhatsApp us
    </a>
  )
}
