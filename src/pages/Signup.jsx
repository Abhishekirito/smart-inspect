import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShieldCheck, Loader2, Mail, Lock, User, AlertCircle, ArrowLeft,
  MailCheck,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { isAppShell } from '../lib/platform.js'

export default function Signup() {
  const { session, signUp } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState('form') // 'form' | 'sent'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // If session gets established (e.g. user clicked email link), auto-navigate to /app
  useEffect(() => {
    if (session) {
      navigate('/app', { replace: true })
    }
  }, [session, navigate])

  const submit = async (e) => {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true); setError('')
    const { data, error } = await signUp(email.trim(), password, { full_name: name.trim() })
    setBusy(false)
    if (error) { setError(error.message); return }
    // Email confirmation OFF → a session is returned; go straight in.
    if (data?.session) { navigate('/app', { replace: true }); return }
    // Email confirmation ON → show "check your email" message.
    setStep('sent')
  }

  // ── "Check your email" screen after sign-up ──────────────────────────
  if (step === 'sent') {
    return (
      <div className="grid min-h-full place-items-center bg-gradient-to-b from-white to-slate-50 px-4 py-10">
        <div className="w-full max-w-md">
          <button
            onClick={() => { setStep('form'); setError('') }}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={16} /> Edit details
          </button>

          <div className="card p-7 shadow-md">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow">
                <MailCheck size={22} />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-slate-800">Check your inbox</h1>
                <p className="text-xs text-slate-400">Confirm your email to get started</p>
              </div>
            </div>

            <p className="mb-5 text-sm text-slate-500 leading-relaxed">
              We sent a confirmation email to <b className="text-slate-700">{email}</b>.
              Click the link in the email to activate your account and log in automatically.
            </p>

            <p className="text-xs text-slate-400 leading-relaxed">
              Didn't receive it? Check your spam folder or{' '}
              <button
                onClick={() => { setStep('form'); setError('') }}
                className="font-semibold text-brand-600 hover:text-brand-700"
              >
                try again with a different email
              </button>.
            </p>

            <Link
              to="/login"
              className="btn-primary mt-6 flex w-full items-center justify-center py-3"
            >
              Go to Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Sign-up form ─────────────────────────────────────────────────────
  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-b from-white to-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        {/* No marketing home in the installed app; the intro is one-time and
            the sign-in link at the foot of the card covers the other direction. */}
        {!isAppShell && (
          <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700">
            <ArrowLeft size={16} /> Back to home
          </Link>
        )}

        <div className="card p-7 shadow-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-800">Create your account</h1>
              <p className="text-xs text-slate-400">Start verifying labels in minutes</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9" type="text" autoComplete="name"
                  value={name} onChange={(e) => setName(e.target.value)} placeholder="Inspector name" />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9" type="password" required autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
              </div>
            </div>
            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : null}
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
