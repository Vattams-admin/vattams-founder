import { useState } from 'react'
import AdminNav from '@/components/AdminNav'
import AdminRoute from '@/components/AdminRoute'
import { DEFAULT_PRICING_CONFIG } from '@/lib/pricingModel'
import { savePricingConfig } from '@/lib/pricingConfig'

export default function AdminPricingBootstrap() {
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function bootstrap() {
    setBusy(true)
    setStatus(null)
    try {
      await savePricingConfig(DEFAULT_PRICING_CONFIG)
      setStatus('SUCCESS: settings/pricing has been created with the approved default pricing configuration.')
    } catch (error) {
      console.error('Pricing bootstrap failed:', error)
      setStatus(`FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminRoute>
      <AdminNav active="payments" />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="card p-6">
          <h1 className="font-display text-3xl text-gold">Pricing Configuration Bootstrap</h1>
          <p className="mt-3 text-sm text-slate-300">
            One-time admin action to create the Firestore settings/pricing document
            from DEFAULT_PRICING_CONFIG.
          </p>

          <button
            type="button"
            onClick={bootstrap}
            disabled={busy}
            className="btn-primary mt-6 disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create Pricing Configuration'}
          </button>

          {status && (
            <p className="mt-5 text-sm text-slate-200">
              {status}
            </p>
          )}
        </div>
      </div>
    </AdminRoute>
  )
}
