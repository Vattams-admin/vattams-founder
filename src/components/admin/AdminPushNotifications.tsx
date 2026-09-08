import { useState } from 'react'
import { registerAdminPushNotifications } from '@/lib/pushNotifications'

export default function AdminPushNotifications() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleEnable() {
    setStatus('loading')
    setMessage('Enabling push notifications…')

    try {
      const token = await registerAdminPushNotifications()

      console.log('VATTAMS ACADEMIA FCM token:', token)

      setStatus('success')
      setMessage('Push notifications are enabled on this device.')
    } catch (error) {
      console.error('Failed to enable push notifications:', error)

      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not enable push notifications.',
      )
    }
  }

  return (
    <section className="mt-8 rounded-card border border-gold/20 bg-white/[0.04] p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-gold">
        Notifications
      </p>

      <h2 className="mt-2 font-display text-2xl text-white">
        Admin Push Notifications
      </h2>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
        Receive important VATTAMS ACADEMIA admin alerts even when the app is
        closed.
      </p>

      <button
        type="button"
        onClick={handleEnable}
        disabled={status === 'loading' || status === 'success'}
        className="mt-5 rounded-full border border-gold/40 bg-gold/10 px-5 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'loading'
          ? 'Enabling…'
          : status === 'success'
            ? 'Notifications Enabled ✓'
            : 'Enable Push Notifications'}
      </button>

      {message && (
        <p
          className={`mt-3 text-sm ${
            status === 'error' ? 'text-red-300' : 'text-slate-300'
          }`}
        >
          {message}
        </p>
      )}
    </section>
  )
}
