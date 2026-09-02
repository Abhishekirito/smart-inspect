// Gate for authenticated-only routes. Redirects to /login (remembering where the
// user was headed) when there is no active Supabase session.
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { AppShellSkeleton } from './Skeleton.jsx'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  const loc = useLocation()

  // Show the shell the session is about to fill, not a bare spinner.
  if (loading) return <AppShellSkeleton />

  if (!session) {
    return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  }

  return children
}
