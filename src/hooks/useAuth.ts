import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged } from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase'

export type AppUser = User & {
  id: string
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let settled = false
    const timeout = window.setTimeout(() => {
      if (settled) return
      console.error('Firebase Auth initialization timed out')
      setUser(null)
      setLoading(false)
      settled = true
    }, 10000)

    const unsubscribe = onAuthStateChanged(
      firebaseAuth,
      (firebaseUser) => {
        if (firebaseUser) {
          const appUser = {
            ...firebaseUser,
            id: firebaseUser.uid,
          } as AppUser

          setUser(appUser)
        } else {
          setUser(null)
        }

        settled = true
        window.clearTimeout(timeout)
        setLoading(false)
      },
      (error) => {
        // Listener itself errored (e.g. broken Firebase config) — never
        // leave `loading` stuck true, or every page that gates on it
        // (StudentDashboard, CourseLearn, Payment, ...) spins forever.
        console.error('Auth state listener error:', error)
        setUser(null)
        settled = true
        window.clearTimeout(timeout)
        setLoading(false)
      }
    )

    return () => {
      settled = true
      window.clearTimeout(timeout)
      unsubscribe()
    }
  }, [])

  return {
    session: user,
    user,
    loading,
  }
}
