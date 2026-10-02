import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { role } = useParams()
  const location = useLocation()

  if (loading) return <div className="auth-loading">Checking your session...</div>
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  if (role && role !== user.role) return <Navigate to={`/${user.role}/overview`} replace />

  return children
}
