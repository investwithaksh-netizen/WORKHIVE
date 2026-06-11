import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/auth'
import Layout from '../components/Layout'
import api from '../lib/api'
import { Activity, Zap, Flame, Target, Users, Check, X, AlertCircle } from 'lucide-react'

const LOAD_COLORS = {
  low:    { bg: 'var(--success-light)', text: 'var(--success-dark)', icon: Activity },
  medium: { bg: 'var(--warning-light)', text: 'var(--warning-dark)', icon: Zap },
  high:   { bg: 'var(--danger-light)',  text: 'var(--danger-dark)',  icon: Flame },
}

export default function Team() {
  const { user } = useAuthStore()
  const [members, setMembers] = useState([])
  const [workload, setWorkload] = useState([])
  const [pendingUsers, setPendingUsers] = useState([])
  const [activeTab, setActiveTab] = useState('members') // 'members' | 'pending'
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const isAdmin = user?.role === 'L1'
  const isManager = user?.role === 'L2'

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchPending = async () => {
    try {
      const res = await api.get('/api/v1/users/pending')
      setPendingUsers(res.data)
    } catch (err) {
      showToast('Failed to fetch pending registration requests', 'error')
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersRes, workloadRes] = await Promise.all([
          api.get('/api/v1/users/org'),
          (isAdmin || isManager)
            ? api.get('/api/v1/tasks/workload')
            : Promise.resolve({ data: [] }),
        ])
        setMembers(membersRes.data)
        setWorkload(workloadRes.data)

        if (isAdmin) {
          await fetchPending()
        }
      } catch (err) {
        showToast('Failed to load team data', 'error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const getWorkload = (userId) =>
    workload.find(w => w.user_id === userId)

  const handleToggleActive = async (userId, currentActive) => {
    try {
      await api.put(`/api/v1/users/${userId}`, { is_active: !currentActive })
      setMembers(prev => prev.map(m =>
        m.id === userId ? { ...m, is_active: !currentActive } : m
      ))
      showToast(`User account ${!currentActive ? 'activated' : 'deactivated'} successfully!`)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update user status', 'error')
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/api/v1/users/${userId}`, { role: newRole })
      setMembers(prev => prev.map(m =>
        m.id === userId ? { ...m, role: newRole } : m
      ))
      showToast(`User role updated to ${newRole} successfully!`)
      if (isAdmin || isManager) {
        const workloadRes = await api.get('/api/v1/tasks/workload')
        setWorkload(workloadRes.data)
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update user role', 'error')
    }
  }

  const handleApprove = async (pendingId) => {
    try {
      await api.post(`/api/v1/users/${pendingId}/approve`)
      setPendingUsers(prev => prev.filter(u => u.id !== pendingId))
      showToast('User registration approved successfully!')
      
      // Refresh list of team members
      const membersRes = await api.get('/api/v1/users/org')
      setMembers(membersRes.data)
      
      if (isAdmin || isManager) {
        const workloadRes = await api.get('/api/v1/tasks/workload')
        setWorkload(workloadRes.data)
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to approve user', 'error')
    }
  }

  const handleReject = async (pendingId) => {
    try {
      await api.post(`/api/v1/users/${pendingId}/reject`)
      setPendingUsers(prev => prev.filter(u => u.id !== pendingId))
      showToast('User registration request rejected.')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to reject user request', 'error')
    }
  }

  const initials = (name) =>
    name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <Layout title="Team">
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-header-title">Team</h2>
          <p className="page-header-sub">
            {activeTab === 'members' 
              ? `${members.length} member${members.length !== 1 ? 's' : ''} in your organisation`
              : `${pendingUsers.length} request${pendingUsers.length !== 1 ? 's' : ''} pending approval`
            }
          </p>
        </div>
      </div>

      {/* Tabs selection (Admins only) */}
      {isAdmin && (
        <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
          <button
            id="tab-members"
            className={`tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            Team Members ({members.length})
          </button>
          <button
            id="tab-pending"
            className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <span>Pending Approvals</span>
            {pendingUsers.length > 0 && (
              <span style={{
                background: 'var(--danger)',
                color: 'white',
                padding: '1px 6px',
                borderRadius: '999px',
                fontSize: '0.7rem',
                fontWeight: 700
              }}>
                {pendingUsers.length}
              </span>
            )}
          </button>
        </div>
      )}

      {loading ? (
        <div className="page-loading">
          <div className="spinner spinner-dark" />
        </div>
      ) : activeTab === 'pending' ? (
        /* ── Pending Approvals Tab ── */
        pendingUsers.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
                <Users size={48} style={{ color: 'var(--gray-300)', marginBottom: '0.5rem' }} />
              </div>
              <p className="empty-state-title">No pending approvals</p>
              <p className="empty-state-desc">All user registration requests have been processed.</p>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Requested Role</th>
                  <th>Submitted</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map(p => (
                  <tr key={p.id} id={`pending-row-${p.id}`}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--brand-400), var(--brand-200))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 'var(--text-xs)', fontWeight: 700, color: 'white', flexShrink: 0
                        }}>
                          {initials(p.full_name)}
                        </div>
                        <div>
                          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-800)' }}>
                            {p.full_name}
                          </p>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${p.role}`}>
                        {p.role}
                      </span>
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          id={`approve-btn-${p.id}`}
                          className="btn btn-primary btn-sm"
                          onClick={() => handleApprove(p.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <Check size={12} strokeWidth={3} />
                          <span>Approve</span>
                        </button>
                        <button
                          id={`reject-btn-${p.id}`}
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleReject(p.id)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--danger-dark)' }}
                        >
                          <X size={12} strokeWidth={3} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* ── Team Members Tab ── */
        <>
          {/* Workload summary (admin/manager only) */}
          {(isAdmin || isManager) && workload.length > 0 && (
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Target size={18} style={{ color: 'var(--brand-600)', flexShrink: 0 }} />
                <span>Team Workload Overview</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                {workload.map(w => {
                  const colors = LOAD_COLORS[w.load_level] || LOAD_COLORS.low
                  return (
                    <div key={w.user_id} style={{
                      padding: 'var(--space-3) var(--space-4)',
                      background: colors.bg,
                      borderRadius: 'var(--radius)',
                      border: `1px solid ${colors.text}30`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', color: colors.text }}><colors.icon size={14} /></span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: colors.text }}>
                          {w.full_name.split(' ')[0]}
                        </span>
                      </div>
                      <p style={{ fontSize: 'var(--text-xs)', color: colors.text, opacity: 0.8 }}>
                        {w.open_task_count} open task{w.open_task_count !== 1 ? 's' : ''} · {w.total_estimated_hours}h estimated
                      </p>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                {Object.entries(LOAD_COLORS).map(([level, c]) => {
                  const Icon = c.icon
                  return (
                    <span key={level} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                      <Icon size={12} style={{ color: c.text }} />
                      <span>{level.charAt(0).toUpperCase() + level.slice(1)} load</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {members.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
                  <Users size={48} style={{ color: 'var(--gray-300)', marginBottom: '0.5rem' }} />
                </div>
                <p className="empty-state-title">No team members yet</p>
                <p className="empty-state-desc">Invite people to your organisation to get started.</p>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    {(isAdmin || isManager) && <th>Workload</th>}
                    <th>Status</th>
                    <th>Joined</th>
                    {isAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => {
                    const w = getWorkload(member.id)
                    const loadColors = w ? LOAD_COLORS[w.load_level] : null

                    return (
                      <tr key={member.id} id={`team-row-${member.id}`}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%',
                              background: 'linear-gradient(135deg, var(--brand-500), var(--brand-300))',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 'var(--text-xs)', fontWeight: 700, color: 'white', flexShrink: 0
                            }}>
                              {initials(member.full_name)}
                            </div>
                            <div>
                              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-800)' }}>
                                {member.full_name}
                                {member.id === user?.id && (
                                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-600)', marginLeft: '0.5rem' }}>
                                    (you)
                                  </span>
                                )}
                              </p>
                              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          {isAdmin && member.id !== user?.id ? (
                            <select
                              id={`role-select-${member.id}`}
                              className="form-input form-select"
                              style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: 'var(--text-xs)', height: 'auto' }}
                              value={member.role}
                              onChange={(e) => handleRoleChange(member.id, e.target.value)}
                            >
                              <option value="client">client</option>
                              <option value="L3">L3</option>
                              <option value="L2">L2</option>
                              <option value="L1">L1</option>
                            </select>
                          ) : (
                            <span className={`badge badge-${member.role}`}>
                              {member.role}
                            </span>
                          )}
                        </td>
                        {(isAdmin || isManager) && (
                          <td>
                            {w ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="badge" style={{ background: loadColors?.bg, color: loadColors?.text, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  {loadColors && <loadColors.icon size={12} />}
                                  <span>{w.open_task_count} tasks</span>
                                </span>
                                {w.total_estimated_hours > 0 && (
                                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
                                    {w.total_estimated_hours}h
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-300)' }}>—</span>
                            )}
                          </td>
                        )}
                        <td>
                          <span className={`badge ${member.is_active ? 'badge-completed' : 'badge-on_hold'}`}>
                            {member.is_active ? '● Active' : '○ Inactive'}
                          </span>
                        </td>
                        <td style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
                          {new Date(member.created_at).toLocaleDateString()}
                        </td>
                        {isAdmin && (
                          <td>
                            {member.id !== user?.id && (
                              <button
                                id={`toggle-active-${member.id}`}
                                className={`btn btn-sm ${member.is_active ? 'btn-secondary' : 'btn-primary'}`}
                                onClick={() => handleToggleActive(member.id, member.is_active)}
                              >
                                {member.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          zIndex: 9999,
          animation: 'slideUp 200ms ease-out'
        }}>
          <div className={`alert alert-${toast.type}`} style={{ boxShadow: 'var(--shadow-lg)' }}>
            {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </Layout>
  )
}
