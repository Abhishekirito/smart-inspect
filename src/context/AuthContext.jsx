// Auth state provider backed by Supabase. Exposes the current session/user and
// sign-in / sign-up / password-reset / sign-out helpers to the whole app via
// useAuth(). Sign-up sends a confirmation email link (not an OTP code).
import { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true

    // Supabase's detectSessionInUrl parses the recovery / email-confirmation token out
    // of the URL hash asynchronously on load, then emits an auth event and cleans the
    // URL itself. We must NOT navigate() before that finishes — doing so strips the hash
    // and the token is lost (this was breaking the password-reset and confirmation links).
    // So nothing here inspects or rewrites the URL eagerly; we route off the EVENT below,
    // once Supabase has established the session.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return
      setSession(s)
      setLoading(false)

      // Recovery link clicked: take the now-authenticated user to the reset form.
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true })
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [navigate])

  const value = {
    session,
    user: session?.user ?? null,
    loading,

    signIn: (email, password) =>
      supabase.auth.signInWithPassword({ email, password }),

    // Sends a confirmation email with a magic link. Once the user clicks
    // the link they are redirected back to /app with an active session.
    signUp: (email, password, meta = {}) =>
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: meta,
          emailRedirectTo: `${window.location.origin}/app`,
        },
      }),

    // Emails a password-reset link that redirects back to this app's /reset-password route.
    resetPassword: (email) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      }),

    // Sets a new password for the user in the current (recovery) session.
    updatePassword: (password) =>
      supabase.auth.updateUser({ password }),

    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
