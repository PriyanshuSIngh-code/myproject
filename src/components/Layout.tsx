import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Scale, Menu, ArrowUpRight, LogOut, User, CheckCircle2, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { user, isLoading, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [logoutNotice, setLogoutNotice] = useState<string | null>(null)

  useEffect(() => {
    if (location.state && (location.state as any).notice) {
      setLogoutNotice((location.state as any).notice)
      // Clear history state to avoid notice persisting on back navigation
      window.history.replaceState({}, document.title)
      const timer = setTimeout(() => setLogoutNotice(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [location.state])

  async function handleSignOut() {
    try {
      await logout()
      setOpen(false)
      setLogoutNotice('You have been logged out successfully.')
      navigate('/', { replace: true })
    } catch (err) {
      console.error('Logout error:', err)
      setOpen(false)
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="app-shell">
      {/* Toast Notification for Logout or Session Notices */}
      {logoutNotice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '90px',
            right: '24px',
            zIndex: 9999,
            background: '#101a33',
            color: '#fff',
            border: '1px solid #c7a45b',
            borderRadius: '12px',
            padding: '12px 18px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: 500,
            animation: 'float 0.3s ease-out'
          }}
        >
          <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
          <span>{logoutNotice}</span>
          <button
            type="button"
            onClick={() => setLogoutNotice(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              marginLeft: '8px',
              padding: 0,
              display: 'flex',
              alignItems: 'center'
            }}
            aria-label="Close notification"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <header className="topbar">
        <Link className="brand" to="/" onClick={() => setOpen(false)}>
          <span className="brand-mark"><Scale size={21} /></span>
          <span>Nayaya<span className="gold-text">Mitra</span><small>LEGAL CLARITY, MADE ACCESSIBLE</small></span>
        </Link>

        <button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>
          <Menu />
        </button>

        <nav className={open ? 'nav-links open' : 'nav-links'}>
          <NavLink to="/chat" onClick={() => setOpen(false)}>AI Legal Guide</NavLink>
          <NavLink to="/advocates" onClick={() => setOpen(false)}>Find an Advocate</NavLink>
          <NavLink to="/legal-aid" onClick={() => setOpen(false)}>Legal Aid</NavLink>
          {isAuthenticated && (user?.role === 'advocate' || user?.role === 'admin') ? (
            <NavLink to="/advocate/dashboard" onClick={() => setOpen(false)}>Advocate Dashboard</NavLink>
          ) : isAuthenticated ? (
            <NavLink to="/dashboard" onClick={() => setOpen(false)}>User Dashboard</NavLink>
          ) : (
            <>
              <NavLink to="/plans" onClick={() => setOpen(false)}>Plans</NavLink>
              <NavLink to="/advocate/login" onClick={() => setOpen(false)} style={{ color: '#c7a45b', fontWeight: 600 }}>Advocate Portal</NavLink>
            </>
          )}

          {/* DYNAMIC AUTHENTICATION SECTION */}
          {isLoading ? (
            /* Loading placeholder preventing layout jump */
            <div style={{ width: '140px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '80px', height: '16px', background: '#e2e8f0', borderRadius: '4px', opacity: 0.6 }} />
            </div>
          ) : isAuthenticated && user ? (
            /* Case 2: Existing user is logged in */
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <NavLink
                to={user.role === 'advocate' || user.role === 'admin' ? '/advocate/dashboard' : '/dashboard'}
                onClick={() => setOpen(false)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--gold, #c7a45b)',
                  fontWeight: 700,
                  fontSize: '13px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: 'rgba(199, 164, 91, 0.08)'
                }}
              >
                <User size={15} style={{ color: '#b38b39' }} />
                <span>{user.role === 'advocate' || user.role === 'admin' ? 'Advocate Dashboard' : 'User Dashboard'}</span>
              </NavLink>

              <button
                type="button"
                className="button button-ghost button-small"
                onClick={handleSignOut}
                title="Sign out of your account"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderColor: '#cbd5e1'
                }}
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          ) : (
            /* Case 1: Visitor is not logged in: [ Login ] [ Sign Up ] */
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                className="button button-ghost button-small"
                to="/login"
                onClick={() => setOpen(false)}
                style={{
                  padding: '9px 15px',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                Login
              </Link>
              <Link
                className="button button-small"
                to="/register"
                onClick={() => setOpen(false)}
                style={{
                  padding: '9px 15px',
                  fontSize: '12px',
                  fontWeight: 700
                }}
              >
                Sign Up <ArrowUpRight size={14} />
              </Link>
            </div>
          )}
        </nav>
      </header>

      <main><Outlet /></main>

      <footer className="footer">
        <div className="footer-brand">
          <span className="brand-mark"><Scale size={18}/></span>
          <strong>NayayaMitra</strong>
        </div>
        <p>Legal information, with clarity and care.</p>
        <div className="footer-links">
          <Link to="/advocate/login">Advocate Portal</Link>
          <Link to="/plans">Plans & Pricing</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/disclaimer">Disclaimer</Link>
        </div>
        <small>© {new Date().getFullYear()} NayayaMitra. Official Indian Legal Information & Authentication Gateway.</small>
      </footer>
    </div>
  )
}
