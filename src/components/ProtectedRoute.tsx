import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { RefreshCw } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'user' | 'advocate' | 'admin'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const location = useLocation()
  const { user, isLoading, isAuthenticated, isPendingVerification } = useAuth()

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={28} className="spin" style={{ color: '#c5a65e', margin: '0 auto 12px' }} />
          <p style={{ color: '#6d7690', fontSize: '13px' }}>Verifying secure session...</p>
        </div>
      </div>
    )
  }

  // 1. Account exists but dual email/mobile verification is incomplete -> redirect to verify
  if (isPendingVerification && user?.id) {
    return <Navigate to={`/verify?userId=${encodeURIComponent(user.id)}`} replace />
  }

  // 2. Unauthenticated -> redirect to login with return state
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // 3. Role authorization check
  if (requiredRole === 'admin' && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace state={{ notice: 'Access denied. Administrator privileges required.' }} />
  }

  if (requiredRole === 'advocate' && user.role !== 'advocate' && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace state={{ notice: 'Access denied: The Advocate Dashboard is exclusively available to verified advocates.' }} />
  }

  // 4. Fully authenticated and authorized
  return <>{children}</>
}
