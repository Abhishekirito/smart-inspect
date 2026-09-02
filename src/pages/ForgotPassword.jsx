import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Loader2, Mail, AlertCircle, ArrowLeft, MailCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.')
      return
    }
    setBusy(true); setError('')
    const { error } = await resetPassword(email.trim())
    setBusy(false)
    // Don't reveal whether an account exists — always show the same confirmation.
    if (error && !/rate/i.test(error.message)) { setError(error.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="grid min-h-full place-items-center bg-gradient-to-b from-white to-slate-50 px-4 py-10">
        <div className="card w-full max-w-md p-8 text-center shadow-md">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <MailCheck size={28} />
          </div>
          <h1 className="text-lg font-extrabold text-slate-800">Check your inbox</h1>
          <p className="mt-2 text-sm text-slate-500">
            If an account exists for <b className="text-slate-700">{email}</b>, we've sent a link to reset your
            password. Open it on this device to set a new one.
          </p>
          <Link to="/login" className="btn-primary mt-6 w-full py-3">Back to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-b from-white to-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/login" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700">
          <ArrowLeft size={16} /> Back to sign in
        </Link>

        <div className="card p-7 shadow-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-800">Forgot password?</h1>
              <p className="text-xs text-slate-400">We'll email you a reset link</p>
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
            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : null}
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
