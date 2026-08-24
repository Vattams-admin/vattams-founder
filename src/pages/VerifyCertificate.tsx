import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CertificateVerification } from '@/types/database'

export default function VerifyCertificate() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<CertificateVerification | null | 'not_found'>(null)
  const [checking, setChecking] = useState(false)
  const [connectionError, setConnectionError] = useState(false)

  async function check() {
    if (!code.trim()) return
    setChecking(true)
    setResult(null)
    setConnectionError(false)
    try {
      const { data, error } = await supabase.rpc('verify_certificate', { code: code.trim() })
      if (error) {
        // An RPC/network error is not the same thing as "no certificate
        // found for this code" — don't tell someone their certificate is
        // invalid when the real problem is our connection.
        console.error('Certificate verification failed:', error)
        setConnectionError(true)
        return
      }
      if (!data || data.length === 0) {
        setResult('not_found')
        return
      }
      setResult(data[0] as CertificateVerification)
    } catch (err) {
      console.error('Unexpected error verifying certificate:', err)
      setConnectionError(true)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl">Verify a certificate</h1>
      <p className="mt-2 text-slate-muted">
        Enter the certificate code printed on the certificate or scanned from its QR code.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Certificate code"
          className="flex-1 rounded-card border border-white/15 bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
        />
        <button onClick={check} disabled={checking} className="btn-primary disabled:opacity-60">
          {checking ? 'Checking…' : 'Verify'}
        </button>
      </div>

      {connectionError && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p className="text-danger">Unable to verify right now. Please try again.</p>
          <button onClick={check} className="btn-secondary text-xs">
            Retry
          </button>
        </div>
      )}

      {result === 'not_found' && (
        <p className="mt-6 text-danger">No certificate found for that code. Double-check and try again.</p>
      )}

      {result && result !== 'not_found' && (
        <div className="card mt-6 p-6">
          <p className={`text-sm font-semibold uppercase tracking-wide ${result.is_valid ? 'text-success' : 'text-danger'}`}>
            {result.is_valid ? 'Valid certificate' : 'This certificate has been revoked'}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-muted">Issued to</dt><dd>{result.student_name}</dd></div>
            {result.course_name && (
              <div className="flex justify-between"><dt className="text-slate-muted">Programme</dt><dd>{result.course_name}</dd></div>
            )}
            <div className="flex justify-between"><dt className="text-slate-muted">Type</dt><dd className="capitalize">{result.certificate_type.replace('_', ' ')}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-muted">Issued</dt><dd>{new Date(result.issued_at).toLocaleDateString('en-IN')}</dd></div>
          </dl>
        </div>
      )}
    </div>
  )
}
