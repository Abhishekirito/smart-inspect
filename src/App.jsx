import { Routes, Route, NavLink, Navigate, useLocation, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, ScanLine, History, Settings as SettingsIcon,
  Menu, ShieldCheck, LogOut, User, Bot,
} from 'lucide-react'
import Dashboard from './pages/Dashboard.jsx'
import Scan from './pages/Scan.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import Report from './pages/Report.jsx'
import Settings from './pages/Settings.jsx'
import Assistant from './pages/Assistant.jsx'
import Landing from './pages/Landing.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ChatWidget from './components/ChatWidget.jsx'
import { AppLaunchSkeleton } from './components/Skeleton.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { isAppShell } from './lib/platform.js'
import { hasOnboarded, rootDestination } from './lib/onboarding.js'
import { hideSplash } from './lib/native.js'

const nav = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/scan', label: 'New Scan', icon: ScanLine },
  { to: '/app/history', label: 'History', icon: History },
  { to: '/app/assistant', label: 'AI Assistant', icon: Bot },
  { to: '/app/settings', label: 'Settings', icon: SettingsIcon },
]

function Sidebar({ open, onClose }) {
  const { user, signOut } = useAuth()
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden transition ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed z-40 flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-5 transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <NavLink to="/" className="flex items-center gap-3 px-2 pb-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="text-base font-extrabold leading-none">Smart Inspect</div>
            <div className="mt-1 text-[11px] font-medium text-slate-400">Legal Metrology · PCR 2011</div>
          </div>
        </NavLink>
        <nav className="space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <n.icon size={18} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-8 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
          Every verdict cites the exact rule clause from the Packaged Commodities Rules, 2011. AI extracts; the deterministic engine decides.
        </div>

        <div className="mt-auto border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2.5 px-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
              <User size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-700">
                {user?.user_metadata?.full_name || 'Signed in'}
              </div>
              <div className="truncate text-[11px] text-slate-400">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="mt-3 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
    </>
  )
}

function AppLayout() {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const current = nav.find((n) => n.to === loc.pathname)?.label
  const title = loc.pathname.startsWith('/app/report') ? 'Compliance Report' : current || 'Smart Inspect'
  return (
    <div className="flex h-full">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur lg:px-8">
          <button className="btn-ghost !px-2 lg:hidden" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex-1 truncate text-sm font-medium text-slate-400">{title}</div>
          <NavLink to="/app/scan" className="btn-primary !py-2 !px-3 text-xs sm:text-sm">
            <ScanLine size={16} /> Scan Product
          </NavLink>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
      <ChatWidget />
    </div>
  )
}

/**
 * What "/" means. In a browser it is the marketing site; in the installed app
 * there is no marketing site — a first launch goes to the intro, a later one to
 * the login form, and an existing session straight to the dashboard.
 */
function Root() {
  const { session, loading } = useAuth()

  // Deciding before the stored session is read would flash the intro at a
  // signed-in user, so hold the launch placeholder until it resolves.
  if (loading) return <AppLaunchSkeleton />

  return <Navigate to={rootDestination({ hasSession: !!session, onboarded: hasOnboarded() })} replace />
}

export default function App() {
  const { loading } = useAuth()

  // Take the native splash down as soon as there is something real to show.
  useEffect(() => {
    if (!loading) hideSplash()
  }, [loading])

  return (
    <Routes>
      <Route path="/" element={isAppShell ? <Root /> : <Landing />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="scan" element={<Scan />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="report/:id" element={<Report />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
