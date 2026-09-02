import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShieldCheck, Loader2, Lock, AlertCircle, CheckCircle2, KeyRound,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { AuthCardSkeleton } from '../components/Skeleton.jsx'

export default function ResetPassword() {
  const { session, loading, updatePassword } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true); setError('')
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => navigate('/app', { replace: true }), 1500)
  }

  // Still resolving the recovery token from the URL.
  if (loading) return <AuthCardSkeleton />

  // Arrived without a valid recovery session (link expired or opened directly).
  if (!session) {
    return (
      <div className="grid min-h-full place-items-center bg-gradient-to-b from-white to-slate-50 px-4 py-10">
        <div className="card w-full max-w-md p-8 text-center shadow-md">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600">
            <AlertCircle size={28} />
          </div>
          <h1 className="text-lg font-extrabold text-slate-800">Reset link invalid or expired</h1>
          <p className="mt-2 text-sm text-slate-500">
            Open the most recent reset email on this device, or request a new link.
          </p>
          <Link to="/forgot-password" className="btn-primary mt-6 w-full py-3">Request a new link</Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="grid min-h-full place-items-center bg-gradient-to-b from-white to-slate-50 px-4 py-10">
        <div className="card w-full max-w-md p-8 text-center shadow-md">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="text-lg font-extrabold text-slate-800">Password updated</h1>
          <p className="mt-2 text-sm text-slate-500">Taking you to your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-full place-items-center bg-gradient-to-b from-white to-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="card p-7 shadow-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow">
              <KeyRound size={22} />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-800">Set a new password</h1>
              <p className="text-xs text-slate-400">Choose a strong password you'll remember</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9" type="password" required autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
              </div>
            </div>
            <div>
              <label className="label">Confirm password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9" type="password" required autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" />
              </div>
            </div>
            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              {busy ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
