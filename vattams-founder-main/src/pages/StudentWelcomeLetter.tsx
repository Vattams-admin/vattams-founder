import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import OnboardingLetter from '@/components/OnboardingLetter'

export default function StudentWelcomeLetter() {
  const { user, loading } = useAuth()
  const [data, setData] = useState<{
    name: string
    code: string
    permanentId: string
    status: string
    issuedAt: string
    subtitle?: string | null
  } | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'not-onboarded' | 'error'>('loading')

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        const snap = await getDoc(doc(firestore, 'students', user.id))
        if (!snap.exists()) {
          setState('error')
          return
        }
        const d = snap.data()
        if (typeof d.student_code !== 'string' || typeof d.student_id !== 'string') {
          setState('not-onboarded')
          return
        }
        setData({
          name: typeof d.full_name === 'string' ? d.full_name : '',
          code: d.student_code,
          permanentId: d.student_id,
          status: typeof d.onboarding_status === 'string' ? d.onboarding_status : 'active',
          issuedAt: typeof d.onboarded_at === 'string' ? d.onboarded_at : new Date().toISOString(),
          subtitle: typeof d.class === 'string' ? d.class : null,
        })
        setState('ready')
      } catch (err) {
        console.error('Failed to load student welcome letter:', err)
        setState('error')
      }
    })()
  }, [user])

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-16 text-slate-muted">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ redirectTo: '/student/welcome-letter' }} replace />

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {state === 'loading' && <p className="text-sm text-slate-muted">Loading…</p>}
      {state === 'error' && <p className="text-sm text-danger">Unable to load your welcome letter right now.</p>}
      {state === 'not-onboarded' && (
        <p className="text-sm text-slate-muted">Your welcome letter will be available once an administrator completes onboarding.</p>
      )}
      {state === 'ready' && data && <OnboardingLetter role="Student" {...data} />}
    </div>
  )
}
