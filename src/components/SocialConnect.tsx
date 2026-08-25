// Reads approved social profile URLs from env vars. No social links
// exist anywhere else in this codebase to pull from, so nothing is
// invented here — each icon only renders once its URL is actually
// configured (VITE_SOCIAL_*_URL), matching the config-driven fallback
// pattern already used for VITE_UPI_VPA (Payment.tsx) and the WhatsApp
// button above.
type SocialKey = 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'twitter'

type SocialLink = { key: SocialKey; label: string; url: string | undefined }

const SOCIAL_LINKS: SocialLink[] = [
  { key: 'instagram', label: 'Instagram', url: import.meta.env.VITE_SOCIAL_INSTAGRAM_URL },
  { key: 'facebook', label: 'Facebook', url: import.meta.env.VITE_SOCIAL_FACEBOOK_URL },
  { key: 'youtube', label: 'YouTube', url: import.meta.env.VITE_SOCIAL_YOUTUBE_URL },
  { key: 'linkedin', label: 'LinkedIn', url: import.meta.env.VITE_SOCIAL_LINKEDIN_URL },
  { key: 'twitter', label: 'X (Twitter)', url: import.meta.env.VITE_SOCIAL_TWITTER_URL }
]

const ICONS: Record<SocialKey, React.ReactNode> = {
  instagram: (
    <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2c-2.7 0-3.06.01-4.12.06-1.06.05-1.79.22-2.42.47a4.9 4.9 0 0 0-1.77 1.15A4.9 4.9 0 0 0 2.53 5.45c-.25.63-.42 1.36-.47 2.42C2.01 8.94 2 9.3 2 12s.01 3.06.06 4.12c.05 1.06.22 1.79.47 2.42.26.65.61 1.2 1.15 1.77.56.55 1.12.9 1.77 1.15.63.25 1.36.42 2.42.47C8.94 21.99 9.3 22 12 22s3.06-.01 4.12-.06c1.06-.05 1.79-.22 2.42-.47a4.9 4.9 0 0 0 1.77-1.15 4.9 4.9 0 0 0 1.15-1.77c.25-.63.42-1.36.47-2.42.05-1.06.06-1.42.06-4.12s-.01-3.06-.06-4.12c-.05-1.06-.22-1.79-.47-2.42a4.9 4.9 0 0 0-1.15-1.77A4.9 4.9 0 0 0 18.54 2.53c-.63-.25-1.36-.42-2.42-.47C15.06 2.01 14.7 2 12 2zm0 1.8c2.65 0 2.97.01 4 .06.97.04 1.5.2 1.85.34.46.18.79.4 1.14.75.35.35.57.68.75 1.14.14.36.3.88.34 1.85.05 1.03.06 1.35.06 4s-.01 2.97-.06 4c-.04.97-.2 1.5-.34 1.85-.18.46-.4.79-.75 1.14-.35.35-.68.57-1.14.75-.36.14-.88.3-1.85.34-1.03.05-1.35.06-4 .06s-2.97-.01-4-.06c-.97-.04-1.5-.2-1.85-.34a3.1 3.1 0 0 1-1.14-.75 3.1 3.1 0 0 1-.75-1.14c-.14-.36-.3-.88-.34-1.85C3.81 14.97 3.8 14.65 3.8 12s.01-2.97.06-4c.04-.97.2-1.5.34-1.85.18-.46.4-.79.75-1.14.35-.35.68-.57 1.14-.75.36-.14.88-.3 1.85-.34C9.03 3.81 9.35 3.8 12 3.8zm5.9 1.7a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z" />
  ),
  facebook: (
    <path d="M13.5 21v-7.6h2.55l.38-2.96h-2.93V8.55c0-.86.24-1.44 1.47-1.44h1.57V4.46A21 21 0 0 0 14.24 4c-2.24 0-3.78 1.37-3.78 3.88v2.56H7.9v2.96h2.56V21h3.04z" />
  ),
  youtube: (
    <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 5 12 5 12 5s-6 0-7.7.3a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 2 12a28 28 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9C6 19 12 19 12 19s6 0 7.7-.3a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.8zM10 15V9l5 3-5 3z" />
  ),
  linkedin: (
    <path d="M6.94 8.5H3.56V20h3.38V8.5zM5.25 3a1.96 1.96 0 1 0 0 3.92 1.96 1.96 0 0 0 0-3.92zM20.45 20h-3.37v-5.9c0-1.4-.03-3.2-1.95-3.2-1.96 0-2.26 1.53-2.26 3.1V20H9.5V8.5h3.24v1.57h.05c.45-.86 1.56-1.77 3.21-1.77 3.43 0 4.06 2.26 4.06 5.2V20z" />
  ),
  twitter: (
    <path d="M18.9 3h3.2l-7 8 8.2 10.9h-6.4l-5-6.6-5.7 6.6H2l7.5-8.6L1.6 3H8.2l4.5 6 6.2-6zm-1.1 17h1.8L7.3 4.9H5.4L17.8 20z" />
  )
}

export default function SocialConnect({ className = '' }: { className?: string }) {
  const configured = SOCIAL_LINKS.filter(
    (s): s is SocialLink & { url: string } => Boolean(s.url)
  )

  if (configured.length === 0) {
    // Clearly identifiable placeholder, not an invented link — matches
    // the "coming soon" pattern used elsewhere (e.g. Competitions.tsx)
    // when a real data source isn't wired up yet.
    return (
      <p className={`text-xs text-slate-muted ${className}`}>
        Social links coming soon.
      </p>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {configured.map((s) => (
        <a
          key={s.key}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`VATTAMS ACADEMIA on ${s.label}`}
          title={s.label}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/25 text-gold-muted transition-colors hover:border-gold hover:text-gold-bright"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {ICONS[s.key]}
          </svg>
        </a>
      ))}
    </div>
  )
}
