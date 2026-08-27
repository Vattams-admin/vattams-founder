import { QRCodeSVG } from 'qrcode.react'

// Shared front/back digital ID card used for both Tutors and Students
// (spec sections 5 and 10 ask for near-identical cards). Renders as a
// normal component so it can be shown inline (dashboard, admin modal) or
// on its own printable page — printing/downloading is done via the
// browser's native print-to-PDF (window.print()), so no PDF-generation
// dependency was added for this.
//
// Only fields the existing app actually collects are shown. There is no
// photo-upload feature anywhere in this project yet, so a lettered
// avatar (initials) stands in for a photograph rather than inventing one.

export interface IdentityCardProps {
  role: 'Tutor' | 'Student'
  name: string
  code: string // Employee Code or Student Code
  permanentId: string // Tutor ID or Student ID
  status: string
  subtitle?: string | null // qualification/expertise for tutors, class/school for students
  issuedAt?: string | null
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function IdentityCard({ role, name, code, permanentId, status, subtitle, issuedAt }: IdentityCardProps) {
  // The QR simply links to the official site — there is no live
  // verification lookup endpoint in this project yet, so the card only
  // makes claims (code, ID, status) that are already shown as plain text
  // above, rather than implying a verification service that doesn't exist.
  const verifyUrl = 'https://academia.vattams.net'

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 print:max-w-none">
      {/* Front */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-center gap-3 bg-gold/10 px-5 py-4">
          <img src="/branding/logo.png" alt="" className="h-10 w-10 object-contain" />
          <div>
            <p className="font-display text-sm uppercase tracking-[0.25em] text-gold">VATTAMS ACADEMIA</p>
            <p className="text-xs text-slate-muted">Digital Identity Card</p>
          </div>
        </div>
        <div className="flex gap-4 px-5 py-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gold/20 font-display text-xl text-gold-bright">
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg">{name}</p>
            <p className="text-xs uppercase tracking-wide text-slate-muted">Designation: {role}</p>
            {subtitle && <p className="mt-1 truncate text-xs text-slate-muted">{subtitle}</p>}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/10 px-5 py-4 text-sm">
          <dt className="text-slate-muted">{role === 'Tutor' ? 'Employee Code' : 'Student Code'}</dt>
          <dd className="text-right font-medium">{code}</dd>
          <dt className="text-slate-muted">{role} ID</dt>
          <dd className="text-right font-medium">{permanentId}</dd>
          <dt className="text-slate-muted">Status</dt>
          <dd className="text-right">
            <span className="rounded-full bg-success/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-success">
              {status}
            </span>
          </dd>
          {issuedAt && (
            <>
              <dt className="text-slate-muted">Issued</dt>
              <dd className="text-right">{new Date(issuedAt).toLocaleDateString('en-IN')}</dd>
            </>
          )}
        </dl>
      </div>

      {/* Back */}
      <div className="card flex items-center justify-between gap-4 p-5">
        <div className="text-xs text-slate-muted">
          <p className="font-display text-sm uppercase tracking-[0.2em] text-gold">VATTAMS ACADEMIA</p>
          <p className="mt-1">
            {role} ID: <span className="text-parchment">{permanentId}</span>
          </p>
          <p className="mt-2">
            Official website:
            <br />
            <span className="text-parchment">academia.vattams.net</span>
          </p>
        </div>
        <div className="shrink-0 rounded-card bg-white p-2">
          <QRCodeSVG value={verifyUrl} size={80} />
        </div>
      </div>

      <div className="print:hidden">
        <button onClick={() => window.print()} className="btn-secondary w-full">
          Print / Download as PDF
        </button>
      </div>
    </div>
  )
}
