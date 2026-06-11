import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import Layout from '../components/Layout'
import api from '../lib/api'
import { Shield, Calendar, Globe, Terminal, ChevronLeft, ChevronRight, Download, Filter, RefreshCw, UserCheck } from 'lucide-react'

const ACTION_COLORS = {
  create:       { bg: '#dcfce7', text: '#15803d' }, // Success green
  register:     { bg: '#e0e7ff', text: '#4338ca' }, // Indigo
  login:        { bg: '#dbeafe', text: '#1d4ed8' }, // Info blue
  update:       { bg: '#fef9c3', text: '#a16207' }, // Warning yellow
  update_access:{ bg: '#fef9c3', text: '#a16207' },
  grant_access: { bg: '#f3e8ff', text: '#7c3aed' }, // Purple
  revoke_access:{ bg: '#fee2e2', text: '#b91c1c' }, // Danger red
  delete:       { bg: '#fee2e2', text: '#b91c1c' },
}

export default function AuditLogs() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(15)
  const [actionFilter, setActionFilter] = useState('all')
  const [resourceFilter, setResourceFilter] = useState('all')
  const [error, setError] = useState('')

  const isAdmin = user?.role === 'L1'

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard')
    } else {
      fetchLogs()
    }
  }, [page, actionFilter, resourceFilter])

  const fetchLogs = async () => {
    setLoading(true)
    setError('')
    try {
      const params = {
        skip: (page - 1) * limit,
        limit: limit,
      }
      if (actionFilter !== 'all') params.action = actionFilter
      if (resourceFilter !== 'all') params.resource_type = resourceFilter

      const res = await api.get('/api/v1/audit', { params })
      setLogs(res.data.logs)
      setTotal(res.data.total)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load audit logs. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (logs.length === 0) return
    
    // Headers
    const headers = ['Timestamp', 'Actor Name', 'Actor Email', 'Action', 'Resource Target', 'Resource ID', 'IP Address', 'User Agent']
    
    // Rows
    const rows = logs.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.user_name,
      log.user_email,
      log.action,
      log.resource_type,
      log.resource_id || '',
      log.ip_address || '',
      `"${(log.user_agent || '').replace(/"/g, '""')}"`
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `workhive_audit_logs_${new Date().toISOString().substring(0,10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const totalPages = Math.ceil(total / limit) || 1

  return (
    <Layout title="Audit Logs">
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={24} style={{ color: 'var(--brand-600)' }} />
            <span>Audit & Compliance Logs</span>
          </h2>
          <p className="page-header-sub">
            Track security, user authentication, data modifications, and project updates across the workspace.
          </p>
        </div>
        <div className="page-header-actions">
          <button 
            className="btn btn-secondary" 
            onClick={handleExportCSV} 
            disabled={logs.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={fetchLogs} 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters Control bar */}
      <div style={{
        display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap',
        marginBottom: 'var(--space-6)', padding: '1rem',
        background: 'var(--surface-card)', borderRadius: 'var(--radius)',
        border: '1px solid var(--gray-100)', boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-600)' }}>
          <Filter size={16} />
          <span>Filters:</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label htmlFor="audit-action-filter" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Action</label>
          <select
            id="audit-action-filter"
            className="form-input form-select"
            style={{ width: 'auto', padding: '0.25rem 2rem 0.25rem 0.5rem', height: '36px', fontSize: 'var(--text-xs)' }}
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Actions</option>
            <option value="login">Login</option>
            <option value="register">Register User</option>
            <option value="create">Create Resource</option>
            <option value="update">Update Resource</option>
            <option value="delete">Delete Resource</option>
            <option value="grant_access">Grant Access</option>
            <option value="revoke_access">Revoke Access</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label htmlFor="audit-resource-filter" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Resource Type</label>
          <select
            id="audit-resource-filter"
            className="form-input form-select"
            style={{ width: 'auto', padding: '0.25rem 2rem 0.25rem 0.5rem', height: '36px', fontSize: 'var(--text-xs)' }}
            value={resourceFilter}
            onChange={e => { setResourceFilter(e.target.value); setPage(1); }}
          >
            <option value="all">All Resources</option>
            <option value="user">User</option>
            <option value="project">Project</option>
            <option value="task">Task</option>
            <option value="file">File</option>
          </select>
        </div>

        {(actionFilter !== 'all' || resourceFilter !== 'all') && (
          <button 
            className="btn btn-ghost btn-sm" 
            onClick={() => { setActionFilter('all'); setResourceFilter('all'); setPage(1); }}
            style={{ color: 'var(--brand-600)', fontWeight: 600 }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--space-6)' }}>
          <span>{error}</span>
        </div>
      )}

      {/* Main Table */}
      {loading ? (
        <div className="table-container">
          <div className="page-loading" style={{ minHeight: 400 }}>
            <div className="spinner spinner-dark" />
            <p style={{ color: 'var(--gray-500)', fontSize: 'var(--text-sm)' }}>Retrieving audit ledger...</p>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
              <Shield size={48} style={{ color: 'var(--gray-300)', marginBottom: '0.5rem' }} />
            </div>
            <p className="empty-state-title">No audit records found</p>
            <p className="empty-state-desc">
              Audit log entries will appear here as users perform actions on the workspace.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Timestamp</th>
                  <th style={{ width: '220px' }}>Actor</th>
                  <th style={{ width: '150px' }}>Action</th>
                  <th style={{ width: '180px' }}>Target Resource</th>
                  <th style={{ width: '130px' }}>IP Address</th>
                  <th>User Agent</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const actionStyle = ACTION_COLORS[log.action] || { bg: 'var(--gray-100)', text: 'var(--gray-700)' }
                  return (
                    <tr key={log.id}>
                      <td style={{ color: 'var(--gray-500)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Calendar size={12} />
                          <span>{new Date(log.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td>
                        <div>
                          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-800)' }}>
                            {log.user_name}
                          </p>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>{log.user_email}</p>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: actionStyle.bg, color: actionStyle.text, textTransform: 'uppercase', fontSize: '10px' }}>
                          {log.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--gray-700)', textTransform: 'capitalize' }}>
                            {log.resource_type}
                          </span>
                          {log.resource_id && (
                            <p style={{ fontSize: '9px', color: 'var(--gray-400)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={log.resource_id}>
                              ID: {log.resource_id}
                            </p>
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--gray-600)', fontSize: 'var(--text-xs)' }}>
                        {log.ip_address ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Globe size={12} style={{ color: 'var(--gray-400)' }} />
                            <span>{log.ip_address}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--gray-300)' }}>—</span>
                        )}
                      </td>
                      <td style={{
                        color: 'var(--gray-500)', fontSize: 'var(--text-xs)',
                        maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }} title={log.user_agent}>
                        {log.user_agent ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Terminal size={12} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                            <span>{log.user_agent}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--gray-300)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination control footer */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: '1.25rem', padding: '0 0.5rem'
          }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
              Showing <strong>{logs.length}</strong> of <strong>{total}</strong> audit entries.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                style={{ padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)', fontWeight: 500 }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                style={{ padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
