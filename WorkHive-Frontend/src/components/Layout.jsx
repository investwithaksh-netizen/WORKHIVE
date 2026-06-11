import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import api from '../lib/api'
import { LayoutDashboard, Briefcase, Users, Bell, BellOff, LogOut, Menu, X, Shield, Calendar } from 'lucide-react'

const NAV_ITEMS = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/projects',  icon: Briefcase, label: 'Projects' },
  { path: '/calendar',  icon: Calendar, label: 'Calendar' },
  { path: '/team',      icon: Users, label: 'Team',      roles: ['L1', 'L2'] },
  { path: '/audit',     icon: Shield, label: 'Audit Logs', roles: ['L1'] },
]

function NotificationBell() {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const navigate = useNavigate()

  const fetchCount = async () => {
    try {
      const res = await api.get('/api/v1/notifications/unread-count')
      setCount(res.data.count)
    } catch { /* silent */ }
  }

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/api/v1/notifications')
      setNotifications(res.data)
    } catch { /* silent */ }
  }

  const markAllRead = async () => {
    try {
      await api.post('/api/v1/notifications/read-all')
      setCount(0)
      setNotifications([])
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (open) fetchNotifications()
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!e.target.closest('.notif-bell')) setOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  const formatTime = (iso) => {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  const parsePayload = (payload) => {
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload)
        if (parsed && typeof parsed === 'object') return parsed
      } catch {}
      return { message: payload, link: null }
    }
    if (payload && typeof payload === 'object') {
      return {
        message: payload.message || 'New notification',
        link: payload.link || null
      }
    }
    return { message: 'Notification', link: null }
  }

  const handleNotifClick = async (notif) => {
    const parsed = parsePayload(notif.payload)
    try {
      // Backend mark_read now deletes it
      await api.post(`/api/v1/notifications/${notif.id}/read`)
      setNotifications(prev => prev.filter(n => n.id !== notif.id))
      setCount(c => Math.max(0, c - 1))
      setOpen(false)
      if (parsed.link) {
        navigate(parsed.link)
      }
    } catch (err) {
      console.error("Failed to dismiss notification", err)
    }
  }

  return (
    <div className="notif-bell" style={{ position: 'relative' }}>
      <button
        id="notification-bell-btn"
        className="btn-icon"
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="notif-badge">{count > 99 ? '99+' : count}</span>
        )}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-header">
            <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Notifications</h4>
            {notifications.length > 0 && (
              <button className="btn btn-ghost" style={{ fontSize: 'var(--text-xs)' }} onClick={markAllRead}>
                Clear all
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon" style={{ color: 'var(--gray-300)', marginBottom: '0.5rem' }}>
                  <BellOff size={32} />
                </div>
                <p className="empty-state-desc">You're all caught up!</p>
              </div>
            ) : notifications.map(n => {
              const parsed = parsePayload(n.payload)
              return (
                <div
                  key={n.id}
                  className="notif-item unread"
                  onClick={() => handleNotifClick(n)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="notif-dot" />
                  <div style={{ flex: 1 }}>
                    <p className="notif-text">{parsed.message}</p>
                    <p className="notif-time">{formatTime(n.created_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Layout({ children, title }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const initials = user?.full_name
    ? user.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const visibleNav = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.includes(user?.role)
  )

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <nav className="sidebar" role="navigation" aria-label="Main navigation">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">W</div>
          <span className="sidebar-logo-text">WorkHive</span>
        </div>

        <div className="sidebar-nav">
          <span className="sidebar-nav-label">Menu</span>
          {visibleNav.map(item => (
            <button
              key={item.path}
              id={`nav-${item.label.toLowerCase()}`}
              className={`nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-item-icon" style={{ display: 'flex', alignItems: 'center' }}>
                <item.icon size={18} />
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={() => setShowLogoutConfirm(true)} title="Logout">
            <div className="avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.full_name}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center' }}>
              <LogOut size={14} />
            </span>
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="btn-icon mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              title="Open menu"
            >
              <Menu size={20} />
            </button>
            <h1 className="topbar-title">{title}</h1>
          </div>
          <div className="topbar-actions">
            <NotificationBell />
            <div className="avatar avatar-lg" style={{ cursor: 'default' }} title={user?.email}>
              {initials}
            </div>
          </div>
        </header>

        <main className="page-content">
          {children}
        </main>
      </div>
      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay" style={{ zIndex: 999 }}>
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Confirm Logout</h3>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--gray-600)', fontSize: 'var(--text-sm)' }}>
                Are you sure you want to log out of WorkHive?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => { setShowLogoutConfirm(false); logout(); }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="modal-overlay"
          onClick={() => setMobileMenuOpen(false)}
          style={{ justifyContent: 'flex-start', padding: 0, zIndex: 400 }}
        >
          <div
            style={{
              width: '280px',
              height: '100%',
              background: 'var(--surface-sidebar)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              animation: 'slideRight 250ms ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sidebar-logo" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div className="sidebar-logo-icon">W</div>
                <span className="sidebar-logo-text" style={{ display: 'block' }}>WorkHive</span>
              </div>
              <button
                className="btn-icon"
                onClick={() => setMobileMenuOpen(false)}
                style={{ color: 'rgb(255 255 255 / 0.65)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="sidebar-nav" style={{ padding: 'var(--space-4) var(--space-3)' }}>
              <span className="sidebar-nav-label" style={{ display: 'block' }}>Menu</span>
              {visibleNav.map(item => (
                <button
                  key={item.path}
                  className={`nav-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate(item.path)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
                >
                  <span className="nav-item-icon" style={{ display: 'flex', alignItems: 'center' }}>
                    <item.icon size={18} />
                  </span>
                  <span style={{ display: 'inline' }}>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="sidebar-footer">
              <div className="sidebar-user" onClick={() => { setMobileMenuOpen(false); setShowLogoutConfirm(true); }} title="Logout" style={{ cursor: 'pointer' }}>
                <div className="avatar">{initials}</div>
                <div className="sidebar-user-info" style={{ display: 'block', marginLeft: '0.5rem', minWidth: 0 }}>
                  <div className="sidebar-user-name" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name}</div>
                  <div className="sidebar-user-role">{user?.role}</div>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center' }}>
                  <LogOut size={14} />
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
