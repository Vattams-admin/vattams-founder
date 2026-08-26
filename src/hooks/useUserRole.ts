import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'

// The shared Navbar (src/components/Navbar.tsx) is used by every signed-
// in visitor — students and tutors alike, since there is no separate
// tutor portal in this project yet (see delivery report). useAuth() only
// exposes the raw Firebase Auth user, with no notion of role, so the
// notification bell needs a small lookup against the same `students` /
// `tutors` collections StudentRegister.tsx / TutorRegister.tsx already
// write to, to know which notification feed (student vs tutor) applies.
//
// Checks `students/{uid}` first, then `tutors/{uid}` — a uid only ever
// exists in one of the two collections (registration fixes the role at
// signup; see StudentRegister.tsx / TutorRegister.tsx).
//
// A tutors/{uid} doc with status !== 'approved' resolves to role: null,
// not 'tutor' — matching the Firestore rule for the tutor notification
// broadcast (see docs/NOTIFICATIONS-FIRESTORE-RULES.md's
// isApprovedTutor()), which only lets an *approved* tutor read the
// tutor-role broadcast feed. Returning 'tutor' for a still-pending
// applicant here would make the bell try that query anyway and hit a
// permission-denied error in the console for every pending tutor.
export function useUserRole(): { role: 'student' | 'tutor' | null; loading: boolean } {
  const { user } = useAuth()
  const [role, setRole] = useState<'student' | 'tutor' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    if (!user) {
      setRole(null)
      setLoading(false)
      return
    }

    setLoading(true)

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
      } catch (error) {
        console.error('[useUserRole] Failed to resolve role:', error)
        if (!cancelled) setRole(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    resolveRole()
    return () => {
      cancelled = true
    }
  }, [user])

  return { role, loading }
}
