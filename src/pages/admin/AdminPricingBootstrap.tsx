import { useState } from 'react'
import AdminNav from '@/components/AdminNav'
import AdminRoute from '@/components/AdminRoute'
import { getPricingConfig, savePricingConfig } from '@/lib/pricingConfig'

export default function AdminPricingBootstrap() {
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function bootstrap() {
    setBusy(true)
    setStatus(null)
    try {
      const current = await getPricingConfig()
      const planKey = 'vattams-competitions:Thirukkural Mastery Championship'

      const updated = {
        ...current,
        catalogCourses: {
          ...current.catalogCourses,
          plans: {
            ...current.catalogCourses.plans,
            [planKey]: {
              regularPrice: 750,
              launchDiscountPercent: 20,
            },
          },
        },
      }

      await savePricingConfig(updated)
      setStatus('SUCCESS: Thirukkural pricing synced safely to ₹750 regular / ₹600 launch price.')
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
            Safe admin action: preserves the existing settings/pricing document
            and updates only the Thirukkural Mastery Championship pricing entry.
          </p>

          <button
            type="button"
            onClick={bootstrap}
            disabled={busy}
            className="btn-primary mt-6 disabled:opacity-60"
          >
            {busy ? 'Syncing…' : 'Sync Thirukkural Pricing'}
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
