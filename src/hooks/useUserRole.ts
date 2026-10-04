import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'

export type UserRole = 'student' | 'tutor'

export function useUserRole(): {
  role: UserRole | null
  loading: boolean
  error: boolean
} {
  const { user } = useAuth()
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!user) {
      setRole(null)
      setError(false)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(false)

    async function resolveRole() {
      try {
        const studentSnap = await getDoc(doc(firestore, 'students', user!.id))
        if (cancelled) return
        if (studentSnap.exists()) {
          setRole('student')
          setLoading(false)
          return
        }

        const tutorSnap = await getDoc(doc(firestore, 'tutors', user!.id))
        if (cancelled) return
        setRole(tutorSnap.exists() && tutorSnap.data().status === 'approved' ? 'tutor' : null)
      } catch (lookupError) {
        console.error('[useUserRole] Failed to resolve role:', lookupError)
        if (!cancelled) {
          setRole(null)
          setError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    resolveRole()
    return () => {
      cancelled = true
    }
  }, [user])

  return { role, loading, error }
}
