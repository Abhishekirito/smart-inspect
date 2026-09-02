// Auth state provider backed by Supabase. Exposes the current session/user and
// sign-in / sign-up / OTP-verify / password-reset / sign-out helpers to the whole
// app via useAuth().
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

    // Sends confirmation email. Returns active session once verified.
    signUp: (email, password, meta = {}) =>
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: meta,
          emailRedirectTo: `${window.location.origin}/app`,
        },
      }),

    // Confirms the 6-digit signup code. `type` must be 'signup' — the type the sign-up
    // token was issued with; 'email' is the passwordless sign-in OTP and rejects this
    // token. Requires the Supabase "Confirm signup" email template to include {{ .Token }}.
    verifySignupOtp: (email, token) =>
      supabase.auth.verifyOtp({ email, token: token.trim(), type: 'signup' }),

    // Re-sends the signup confirmation email.
    resendSignupOtp: (email) =>
      supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${window.location.origin}/app` } }),

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
