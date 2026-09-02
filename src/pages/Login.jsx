import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShieldCheck, Loader2, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { isAppShell } from '../lib/platform.js'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const dest = location.state?.from || '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.')
      return
    }
    setBusy(true); setError('')
    const { error } = await signIn(email.trim(), password)
    setBusy(false)
    if (error) { setError(error.message); return }
    navigate(dest, { replace: true })
  }

  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-b from-white to-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        {/* The installed app has no marketing home to go back to — and in the
            app shell this screen is the root. */}
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
              <h1 className="text-lg font-extrabold text-slate-800">Welcome back</h1>
              <p className="text-xs text-slate-400">Sign in to your Smart Inspect account</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label !mb-0">Password</label>
                <Link to="/forgot-password" className="mb-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9" type="password" required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </div>
            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : null}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-brand-600 hover:text-brand-700">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
