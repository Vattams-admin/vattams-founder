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
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        const appUser = {
          ...firebaseUser,
          id: firebaseUser.uid,
        } as AppUser

        setUser(appUser)
      } else {
        setUser(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  return {
    session: user,
    user,
    loading,
  }
}
