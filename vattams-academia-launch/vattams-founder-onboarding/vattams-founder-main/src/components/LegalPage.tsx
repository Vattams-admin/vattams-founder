export default function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">Legal</p>
      <h1 className="mt-3 font-display text-3xl">{title}</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-parchment/90">
        {children}
      </div>
    </div>
  )
}