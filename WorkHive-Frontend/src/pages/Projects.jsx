import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import Layout from '../components/Layout'
import api from '../lib/api'
import { FolderOpen, Calendar, AlertTriangle, Plus, AlertCircle, X } from 'lucide-react'

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'planning', label: 'Planning' },
  { key: 'active', label: 'Active' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'completed', label: 'Completed' },
]

const STATUS_COLORS = {
  planning: { bg: 'var(--gray-100)', text: 'var(--gray-600)', dot: 'var(--gray-400)' },
  active:   { bg: 'var(--info-light)', text: 'var(--info-dark)', dot: 'var(--info)' },
  on_hold:  { bg: 'var(--warning-light)', text: 'var(--warning-dark)', dot: 'var(--warning)' },
  completed:{ bg: 'var(--success-light)', text: 'var(--success-dark)', dot: 'var(--success)' },
}

function CreateProjectModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', description: '', due_date: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = { name: form.name, description: form.description || null }
      if (form.due_date) payload.due_date = new Date(form.due_date).toISOString()
      const res = await api.post('/api/v1/projects', payload)
      onCreate(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">New Project</h3>
          <button className="btn-icon" onClick={onClose} title="Close" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>
        <form id="create-project-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label" htmlFor="proj-name">Project name *</label>
              <input
                id="proj-name"
                className="form-input"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Website Redesign"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="proj-desc">Description</label>
              <textarea
                id="proj-desc"
                className="form-input form-textarea"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What is this project about?"
                rows={3}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="proj-due">Due date</label>
              <input
                id="proj-due"
                type="date"
                className="form-input"
                value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            {error && (
              <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="create-project-submit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Creating…</> : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const canCreate = ['L1', 'L2'].includes(user?.role)

  useEffect(() => { fetchProjects() }, [])

  const fetchProjects = async () => {
    try {
      const res = await api.get('/api/v1/projects')
      setProjects(res.data)
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = projects.filter(p => {
    const matchesTab = activeTab === 'all' || p.status === activeTab
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesTab && matchesSearch
  })

  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null

  return (
    <Layout title="Projects">
      <div className="page-header">
        <div className="page-header-left">
          <h2 className="page-header-title">Projects</h2>
          <p className="page-header-sub">
            {projects.length} project{projects.length !== 1 ? 's' : ''} in your workspace
          </p>
        </div>
        <div className="page-header-actions">
          {canCreate && (
            <button
              id="new-project-btn"
              className="btn btn-primary"
              onClick={() => setShowModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
            >
              <Plus size={16} />
              <span>New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Status filter tabs & search input */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              className={`tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span style={{
                background: activeTab === tab.key ? 'var(--brand-100)' : 'var(--gray-100)',
                color: activeTab === tab.key ? 'var(--brand-700)' : 'var(--gray-500)',
                padding: '1px 7px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700
              }}>
                {tab.key === 'all' ? projects.length : projects.filter(p => p.status === tab.key).length}
              </span>
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <input
            id="project-search-input"
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.25rem', height: '36px' }}
            placeholder="Search projects..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', display: 'flex', alignItems: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="card animate-pulse" style={{ height: 180, background: 'var(--gray-100)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
              <FolderOpen size={48} style={{ color: 'var(--gray-300)', marginBottom: '0.5rem' }} />
            </div>
            <p className="empty-state-title">
              {searchQuery ? 'No matching projects found' : (activeTab === 'all' ? 'No projects yet' : `No ${activeTab.replace('_', ' ')} projects`)}
            </p>
            <p className="empty-state-desc">
              {searchQuery ? 'Try checking your spelling or adjusting your search keywords.' : (canCreate && activeTab === 'all'
                ? 'Create your first project to get your team organised.'
                : 'Projects matching this filter will appear here.')}
            </p>
            {canCreate && activeTab === 'all' && !searchQuery && (
              <button id="empty-create-btn" className="btn btn-primary" onClick={() => setShowModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Plus size={16} />
                <span>Create Project</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 'var(--space-4)' }}>
          {filtered.map(project => {
            const colors = STATUS_COLORS[project.status] || STATUS_COLORS.planning
            const isOverdue = project.due_date && new Date(project.due_date) < new Date() && project.status !== 'completed'

            return (
              <div
                key={project.id}
                id={`project-${project.id}`}
                className="card card-hover"
                onClick={() => navigate(`/projects/${project.id}`)}
                style={{ cursor: 'pointer', padding: 'var(--space-5)' }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                  <h3 style={{
                    fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--gray-900)',
                    lineHeight: 1.3, flex: 1, marginRight: 'var(--space-2)'
                  }}>
                    {project.name}
                  </h3>
                  <span className="badge" style={{ background: colors.bg, color: colors.text, flexShrink: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.dot, display: 'inline-block' }} />
                    {project.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Description */}
                <p style={{
                  fontSize: 'var(--text-sm)', color: 'var(--gray-500)',
                  lineHeight: 1.5, marginBottom: 'var(--space-4)',
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>
                  {project.description || 'No description provided.'}
                </p>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: 'var(--text-xs)',
                    color: isOverdue ? 'var(--danger)' : 'var(--gray-400)',
                    fontWeight: isOverdue ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    {isOverdue ? (
                      <>
                        <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                        <span>Overdue · </span>
                      </>
                    ) : project.due_date ? (
                      <>
                        <Calendar size={12} style={{ flexShrink: 0 }} />
                        <span>Due </span>
                      </>
                    ) : null}
                    <span>{project.due_date ? formatDate(project.due_date) : 'No due date'}</span>
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
                    Created {formatDate(project.created_at)}{project.created_by_name && ` by ${project.created_by_name}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onCreate={newProject => setProjects(prev => [newProject, ...prev])}
        />
      )}
    </Layout>
  )
}
