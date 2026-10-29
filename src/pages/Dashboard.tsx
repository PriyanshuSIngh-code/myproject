import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  MessageCircle,
  FileText,
  Search,
  ShieldCheck,
  CheckCircle2,
  Mail,
  Smartphone,
  Calendar,
  Lock,
  LogOut,
  Edit3
} from 'lucide-react'
import { authClient, type AuthUser, getStoredUser } from '../lib/authClient'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [user, setUser] = useState<AuthUser | null>(getStoredUser())

  // Edit profile state
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [fullNameInput, setFullNameInput] = useState(user?.full_name || '')
  const [editBusy, setEditBusy] = useState(false)
  const [editMsg, setEditMsg] = useState('')
  const [editError, setEditError] = useState('')

  // Change password state
  const [showChangePass, setShowChangePass] = useState(false)
  const [currPass, setCurrPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confPass, setConfPass] = useState('')
  const [passBusy, setPassBusy] = useState(false)
  const [passMsg, setPassMsg] = useState('')
  const [passError, setPassError] = useState('')

  useEffect(() => {
    async function loadLatestUser() {
      try {
        const res = await authClient.getMe()
        if (res.user) {
          setUser(res.user)
          setFullNameInput(res.user.full_name)
        }
      } catch {
        // Fallback to stored user
      }
    }
    loadLatestUser()
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/', { state: { notice: 'You have been logged out successfully.' } })
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setEditError('')
    setEditMsg('')

    if (!fullNameInput.trim() || fullNameInput.trim().length < 2) {
      setEditError('Name must be at least 2 characters long.')
      return
    }

    setEditBusy(true)
    try {
      const res = await authClient.updateProfile({ fullName: fullNameInput.trim() })
      setUser(res.user)
      setEditMsg(res.message || 'Profile updated successfully!')
      setTimeout(() => {
        setShowEditProfile(false)
        setEditMsg('')
      }, 1200)
    } catch (err: any) {
      setEditError(err.message || 'Failed to update profile.')
    } finally {
      setEditBusy(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPassError('')
    setPassMsg('')

    if (!currPass) {
      setPassError('Please enter your current password.')
      return
    }
    if (newPass.length < 8) {
      setPassError('New password must be at least 8 characters long.')
      return
    }
    if (newPass !== confPass) {
      setPassError('New passwords do not match.')
      return
    }

    setPassBusy(true)
    try {
      const res = await authClient.changePassword({
        currentPassword: currPass,
        newPassword: newPass,
        confirmPassword: confPass
      })
      setPassMsg(res.message || 'Password changed successfully!')
      setCurrPass('')
      setNewPass('')
      setConfPass('')
      setTimeout(() => {
        setShowChangePass(false)
        setPassMsg('')
      }, 1500)
    } catch (err: any) {
      setPassError(err.message || 'Failed to change password.')
    } finally {
      setPassBusy(false)
    }
  }

  const registeredDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : 'Active'

  return (
    <section className="section container">
      {/* Top Welcome Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="eyebrow">USER DASHBOARD · VERIFIED CITIZEN WORKSPACE</div>
          <h1 className="page-title" style={{ margin: '8px 0 4px 0' }}>
            User <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Welcome back, {user?.full_name || 'Member'}. Your verified personal portal for legal orientation and support.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="button button-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '12px' }}
        >
          <LogOut size={15} /> Sign Out
        </button>
      </div>

      {/* Account & Verification Badges Banner */}
      <div
        style={{
          marginTop: '28px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '20px',
          padding: '24px 28px',
          boxShadow: '0 8px 30px rgba(16, 26, 51, 0.04)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', color: '#94a3b8' }}>
              SECURITY & IDENTITY PROFILE
            </div>
            <h2 style={{ fontSize: '20px', margin: '4px 0 0', color: '#101a33' }}>
              {user?.full_name}
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowEditProfile(!showEditProfile)}
              className="button button-ghost"
              style={{ padding: '8px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Edit3 size={13} /> Edit Profile
            </button>
            <button
              type="button"
              onClick={() => setShowChangePass(!showChangePass)}
              className="button button-ghost"
              style={{ padding: '8px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Lock size={13} /> Change Password
            </button>
          </div>
        </div>

        {/* Edit Profile Dropdown Panel */}
        {showEditProfile && (
          <form
            onSubmit={handleUpdateProfile}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px',
              marginTop: '16px'
            }}
          >
            <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#1e293b' }}>Update Display Name</h4>
            {editError && (
              <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '8px' }}>{editError}</div>
            )}
            {editMsg && (
              <div style={{ color: '#16a34a', fontSize: '12px', marginBottom: '8px' }}>{editMsg}</div>
            )}
            <div style={{ display: 'flex', gap: '10px', maxWidth: '420px' }}>
              <input
                type="text"
                value={fullNameInput}
                onChange={e => setFullNameInput(e.target.value)}
                className="text-input"
                style={{ padding: '8px 12px', fontSize: '13px' }}
                placeholder="Full Name"
                disabled={editBusy}
              />
              <button type="submit" className="button button-small" disabled={editBusy}>
                {editBusy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* Change Password Dropdown Panel */}
        {showChangePass && (
          <form
            onSubmit={handleChangePassword}
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px',
              marginTop: '16px'
            }}
          >
            <h4 style={{ margin: '0 0 10px', fontSize: '13px', color: '#1e293b' }}>Change Account Password</h4>
            {passError && (
              <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '8px' }}>{passError}</div>
            )}
            {passMsg && (
              <div style={{ color: '#16a34a', fontSize: '12px', marginBottom: '8px' }}>{passMsg}</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              <input
                type="password"
                value={currPass}
                onChange={e => setCurrPass(e.target.value)}
                className="text-input"
                style={{ padding: '8px 12px', fontSize: '12px' }}
                placeholder="Current Password"
                required
                disabled={passBusy}
              />
              <input
                type="password"
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                className="text-input"
                style={{ padding: '8px 12px', fontSize: '12px' }}
                placeholder="New Password (min 8 chars)"
                required
                disabled={passBusy}
              />
              <input
                type="password"
                value={confPass}
                onChange={e => setConfPass(e.target.value)}
                className="text-input"
                style={{ padding: '8px 12px', fontSize: '12px' }}
                placeholder="Confirm New Password"
                required
                disabled={passBusy}
              />
            </div>
            <button
              type="submit"
              className="button button-small"
              disabled={passBusy}
              style={{ marginTop: '12px' }}
            >
              {passBusy ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        )}

        {/* Identity & Badges Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            marginTop: '20px'
          }}
        >
          {/* Email Item */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#f1f5f9',
                display: 'grid',
                placeItems: 'center',
                color: '#475569'
              }}
            >
              <Mail size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Email Address</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                {user?.email || 'Not configured'}
              </div>
              <div style={{ marginTop: '4px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: '#dcfce7',
                    color: '#15803d'
                  }}
                >
                  <CheckCircle2 size={11} /> Email Verified
                </span>
              </div>
            </div>
          </div>

          {/* Phone Item */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#f1f5f9',
                display: 'grid',
                placeItems: 'center',
                color: '#475569'
              }}
            >
              <Smartphone size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Mobile Number</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                {user?.phone_number || 'Registered Mobile'}
              </div>
              <div style={{ marginTop: '4px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 700,
                    background: '#dcfce7',
                    color: '#15803d'
                  }}
                >
                  <CheckCircle2 size={11} /> Mobile SMS Verified
                </span>
              </div>
            </div>
          </div>

          {/* Member Since Item */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#f1f5f9',
                display: 'grid',
                placeItems: 'center',
                color: '#475569'
              }}
            >
              <Calendar size={18} />
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Account Status</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                Active & Verified
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                Member since {registeredDate}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Navigation Cards */}
      <div className="dashboard-grid">
        <Link to="/chat" className="dashboard-card">
          <MessageCircle />
          <h3>Ask a legal question</h3>
          <p>Get oriented with AI citation-backed answers under Indian Law.</p>
          <span>
            Open guide <ArrowRight size={15} />
          </span>
        </Link>
        <Link to="/advocates" className="dashboard-card">
          <Search />
          <h3>Find an advocate</h3>
          <p>Browse verified legal advocates by practice area and jurisdiction.</p>
          <span>
            Browse directory <ArrowRight size={15} />
          </span>
        </Link>
        <Link to="/legal-aid" className="dashboard-card">
          <FileText />
          <h3>Legal aid resources</h3>
          <p>Connect with NALSA and DLSA government legal-aid services.</p>
          <span>
            View resources <ArrowRight size={15} />
          </span>
        </Link>
        {(user?.role === 'advocate' || user?.role === 'admin') && (
          <Link to="/advocate/dashboard" className="dashboard-card" style={{ borderColor: 'var(--gold, #c7a45b)', background: 'rgba(199, 164, 91, 0.05)' }}>
            <FileText style={{ color: 'var(--gold, #c7a45b)' }} />
            <h3>AI Legal Case Drafting</h3>
            <p>Access the professional Advocate Studio for legal notices, Section 138 drafts, and case management.</p>
            <span style={{ color: 'var(--gold, #c7a45b)', fontWeight: 600 }}>
              Open Advocate Dashboard <ArrowRight size={15} />
            </span>
          </Link>
        )}
      </div>

      {user?.role !== 'advocate' && user?.role !== 'admin' && (
        <div className="notice-panel" style={{ marginTop: '20px', borderColor: '#c7a45b', background: 'rgba(199, 164, 91, 0.05)' }}>
          <FileText size={20} style={{ color: '#c7a45b', flexShrink: 0 }} />
          <div>
            <strong>Are you a practicing Advocate?</strong>
            <p style={{ margin: '4px 0 6px 0', fontSize: '13px' }}>
              The <strong>AI Legal Case Drafting Studio</strong> and <strong>Saved Cases Database</strong> are located exclusively inside the <strong>Advocate Dashboard</strong>. Subscribe to an eligible advocate plan or verify your credentials to access case drafting.
            </p>
            <Link to="/plans" className="button button-small" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              View Advocate Plans & Activate <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      <div className="notice-panel" style={{ marginTop: '28px' }}>
        <ShieldCheck />
        <div>
          <strong>Verified Security Standard</strong>
          <p>
            Your account is verified under NayayaMitra's dual-verification compliance protocol. Keep your credentials private and never share OTPs with third parties.
          </p>
        </div>
      </div>
    </section>
  )
}
