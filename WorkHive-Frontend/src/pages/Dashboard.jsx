import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import Layout from '../components/Layout'
import api from '../lib/api'
import { FolderKanban, CheckSquare, AlertTriangle, AlertCircle, Calendar, ArrowRight, Smile, Lock, X, Trash2 } from 'lucide-react'

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <div className="stat-card-icon" style={{ background: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      <div className="stat-card-value" style={{ color }}>{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  )
}

function QuickTaskItem({ task, onMarkDone, onClick }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date()

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.75rem var(--space-2)', borderBottom: '1px solid var(--gray-100)',
        cursor: 'pointer', borderRadius: 'var(--radius)',
        transition: 'all var(--transition-fast)'
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-50)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <button
        id={`mark-done-${task.id}`}
        onClick={(e) => {
          e.stopPropagation()
          onMarkDone(task.id)
        }}
        style={{
          width: 20, height: 20, borderRadius: '50%',
          border: '2px solid var(--gray-300)',
          background: 'transparent', cursor: 'pointer', flexShrink: 0,
          transition: 'all var(--transition-fast)'
        }}
        onMouseEnter={e => { e.target.style.borderColor = 'var(--success)'; e.target.style.background = 'var(--success-light)' }}
        onMouseLeave={e => { e.target.style.borderColor = 'var(--gray-300)'; e.target.style.background = 'transparent' }}
        title="Mark as done"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="truncate" style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--gray-800)' }}>
          {task.title}
        </p>
        {task.due_date && (
          <p style={{ fontSize: 'var(--text-xs)', color: isOverdue ? 'var(--danger)' : 'var(--gray-400)', marginTop: 2, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {isOverdue ? (
              <>
                <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                <span>Overdue · </span>
              </>
            ) : (
              <Calendar size={12} style={{ flexShrink: 0 }} />
            )}
            <span>{new Date(task.due_date).toLocaleDateString()}</span>
          </p>
        )}
      </div>
      <span className={`badge badge-${task.priority}`}>{task.priority}</span>
    </div>
  )
}

function PersonalTaskDetailDrawer({ task, onClose, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    start_date: task.start_date ? task.start_date.substring(0, 10) : '',
    due_date: task.due_date ? task.due_date.substring(0, 10) : '',
    status: task.status
  })
  const [saveLoading, setSaveLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!task) return
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      start_date: task.start_date ? task.start_date.substring(0, 10) : '',
      due_date: task.due_date ? task.due_date.substring(0, 10) : '',
      status: task.status
    })
    setIsEditing(false)
    setError('')
  }, [task?.id])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaveLoading(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        status: form.status,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null
      }
      const res = await api.put(`/api/v1/tasks/personal/${task.id}`, payload)
      onUpdate(res.data)
      setIsEditing(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update task')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleStatusChangeDirectly = async (newStatus) => {
    try {
      const res = await api.put(`/api/v1/tasks/personal/${task.id}`, { status: newStatus })
      onUpdate(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update status')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this personal task?")) return
    try {
      await api.delete(`/api/v1/tasks/personal/${task.id}`)
      onDelete(task.id)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete task')
    }
  }

  if (!task) return null

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end'
    }}>
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
           onClick={onClose} />
      <div style={{
        width: 440, background: 'var(--surface-card)',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
        animation: 'slideUp var(--transition)',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            {isEditing ? (
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--gray-900)' }}>Edit Personal Task</h3>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <span className="badge badge-personal">Personal</span>
                  <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                  <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
                </div>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1.4 }}>
                  {task.title}
                </h3>
              </>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            {!isEditing && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditing(true)}
                style={{ padding: '0.25rem 0.5rem' }}
              >
                Edit
              </button>
            )}
            {isEditing && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setIsEditing(false)}
                style={{ padding: '0.25rem 0.5rem' }}
              >
                Cancel
              </button>
            )}
            <button className="btn-icon" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto' }}>
          {isEditing ? (
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="edit-personal-title">Title *</label>
                <input
                  id="edit-personal-title"
                  className="form-input"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label" htmlFor="edit-personal-desc">Description</label>
                <textarea
                  id="edit-personal-desc"
                  className="form-input form-textarea"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  placeholder="Private details..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-personal-priority">Priority</label>
                  <select
                    id="edit-personal-priority"
                    className="form-input form-select"
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-personal-status">Status</label>
                  <select
                    id="edit-personal-status"
                    className="form-input form-select"
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="done">Done</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-personal-start">Start date</label>
                  <input
                    id="edit-personal-start"
                    type="date"
                    className="form-input"
                    value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-personal-due">Due date</label>
                  <input
                    id="edit-personal-due"
                    type="date"
                    className="form-input"
                    value={form.due_date}
                    onChange={e => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
              </div>

              {error && (
                <div className="alert alert-error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleDelete}
                  style={{ color: 'var(--danger)', border: '1px solid #fca5a5' }}
                >
                  Delete
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={saveLoading}
                >
                  {saveLoading ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <>
              {task.description ? (
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Description
                  </p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{task.description}</p>
                </div>
              ) : (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-400)', fontStyle: 'italic' }}>No description provided.</p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderTop: '1px solid var(--gray-100)', paddingTop: '1.25rem' }}>
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Start Date</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-700)', fontWeight: 500 }}>
                    {task.start_date ? new Date(task.start_date).toLocaleDateString() : 'None'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Due Date</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: isOverdue ? 'var(--danger)' : 'var(--gray-700)', fontWeight: isOverdue ? 600 : 500, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span>{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</span>
                    {isOverdue && <span style={{ color: 'var(--danger)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}><AlertTriangle size={12} /> Overdue</span>}
                  </p>
                </div>
              </div>

              {/* Status Select */}
              <div className="form-group" style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '1.25rem' }}>
                <label className="form-label" htmlFor="personal-drawer-status">Status</label>
                <select
                  id="personal-drawer-status"
                  className="form-input form-select"
                  value={task.status}
                  onChange={e => handleStatusChangeDirectly(e.target.value)}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [stats, setStats] = useState({ projects: 0, tasks: 0, overdue: 0 })
  const [myTasks, setMyTasks] = useState([])
  const [recentProjects, setRecentProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [personalTasks, setPersonalTasks] = useState([])
  const [personalLoading, setPersonalLoading] = useState(false)
  const [showAddPersonal, setShowAddPersonal] = useState(false)
  const [personalForm, setPersonalForm] = useState({
    title: '', priority: 'medium', due_date: '', start_date: ''
  })
  const [selectedPersonalTask, setSelectedPersonalTask] = useState(null)

  const handleUpdatePersonalTask = (updatedTask) => {
    if (updatedTask.status === 'done') {
      setPersonalTasks(prev => prev.filter(t => t.id !== updatedTask.id))
      setMyTasks(prev => prev.filter(t => t.id !== updatedTask.id))
      setStats(prev => ({ ...prev, tasks: Math.max(0, prev.tasks - 1) }))
    } else {
      setPersonalTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t))
      setMyTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t))
    }
  }

  const handleDeletePersonalTask = (taskId) => {
    setPersonalTasks(prev => prev.filter(t => t.id !== taskId))
    setMyTasks(prev => prev.filter(t => t.id !== taskId))
    setStats(prev => ({ ...prev, tasks: Math.max(0, prev.tasks - 1) }))
  }

  const isAdmin = user?.role === 'L1'
  const isManager = user?.role === 'L2'

  useEffect(() => {
    fetchData()
    fetchPersonalTasks()
  }, [])

  const fetchPersonalTasks = async () => {
    setPersonalLoading(true)
    try {
      const res = await api.get('/api/v1/tasks/personal')
      setPersonalTasks(res.data)
    } catch (err) {
      console.error('Failed to fetch personal tasks', err)
    } finally {
      setPersonalLoading(false)
    }
  }

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [projectsRes, tasksRes] = await Promise.all([
        api.get('/api/v1/projects'),
        api.get('/api/v1/tasks/my'),
      ])

      const projects = projectsRes.data
      const myTaskList = tasksRes.data

      const now = new Date()
      const overdue = myTaskList.filter(t => t.due_date && new Date(t.due_date) < now)

      setStats({
        projects: projects.filter(p => p.status === 'active').length,
        tasks: myTaskList.length,
        overdue: overdue.length,
      })
      setMyTasks(myTaskList.slice(0, 8))
      setRecentProjects(projects.slice(0, 4))
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch dashboard data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkDone = async (taskId, isPersonalTask = false) => {
    try {
      if (isPersonalTask) {
        await api.put(`/api/v1/tasks/personal/${taskId}`, { status: 'done' })
        setPersonalTasks(prev => prev.filter(t => t.id !== taskId))
        setMyTasks(prev => prev.filter(t => t.id !== taskId))
        setStats(prev => ({ ...prev, tasks: Math.max(0, prev.tasks - 1) }))
      } else {
        await api.put(`/api/v1/tasks/${taskId}`, { status: 'done' })
        setMyTasks(prev => prev.filter(t => t.id !== taskId))
        setStats(prev => ({ ...prev, tasks: Math.max(0, prev.tasks - 1) }))
      }
    } catch (err) {
      console.error('Failed to mark task as done', err)
    }
  }

  const handleAddPersonalTask = async (e) => {
    e.preventDefault()
    if (!personalForm.title.trim()) return
    try {
      const payload = {
        title: personalForm.title,
        priority: personalForm.priority,
        due_date: personalForm.due_date ? new Date(personalForm.due_date).toISOString() : null,
        start_date: personalForm.start_date ? new Date(personalForm.start_date).toISOString() : null,
        is_personal: true
      }
      const res = await api.post('/api/v1/tasks/personal', payload)
      setPersonalTasks(prev => [res.data, ...prev])
      setPersonalForm({ title: '', priority: 'medium', due_date: '', start_date: '' })
      setShowAddPersonal(false)
    } catch (err) {
      console.error('Failed to create personal task', err)
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const statusColor = {
    planning: 'var(--gray-400)',
    active: 'var(--info)',
    on_hold: 'var(--warning)',
    completed: 'var(--success)',
  }

  return (
    <Layout title="Dashboard">
      {/* Greeting */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--gray-900)' }}>
          {greeting()}, {user?.full_name ? user.full_name.split(' ')[0] : 'User'}
        </h2>
        <p style={{ color: 'var(--gray-500)', fontSize: 'var(--text-sm)', marginTop: '0.25rem' }}>
          Here's what's happening across your workspace today.
        </p>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={fetchData} className="btn btn-sm btn-primary" style={{ marginLeft: 'auto' }}>Retry</button>
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="stats-grid">
          {[1,2,3].map(i => (
            <div key={i} className="stat-card animate-pulse" style={{ height: 120, background: 'var(--gray-100)' }} />
          ))}
        </div>
      ) : (
        <div className="stats-grid">
          <StatCard
            icon={FolderKanban} label="Active Projects" value={stats.projects}
            sub="across your organisation" color="var(--brand-600)"
          />
          <StatCard
            icon={CheckSquare} label="My Open Tasks" value={stats.tasks}
            sub="assigned to you" color="var(--info)"
          />
          <StatCard
            icon={AlertTriangle} label="Overdue Tasks" value={stats.overdue}
            sub="need attention" color={stats.overdue > 0 ? 'var(--danger)' : 'var(--success)'}
          />
        </div>
      )}

      {/* Main grid */}
      <div className="dashboard-grid">
        {/* Left Column: My Tasks + My Personal Tasks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* My Tasks */}
          <div className="card">
            <div className="flex-between mb-4">
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>My Tasks</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => navigate('/projects')} id="view-all-tasks-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>View projects</span>
                <ArrowRight size={14} />
              </button>
            </div>
            {loading ? (
              <div className="page-loading" style={{ minHeight: 120 }}>
                <div className="spinner spinner-dark" />
              </div>
            ) : myTasks.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 0' }}>
                <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
                  <Smile size={48} style={{ color: 'var(--gray-300)', marginBottom: '0.5rem' }} />
                </div>
                <p className="empty-state-title">All done!</p>
                <p className="empty-state-desc">You have no open tasks. Enjoy the calm.</p>
              </div>
            ) : (
              <>
                {myTasks.map(task => (
                  <QuickTaskItem
                    key={task.id}
                    task={task}
                    onMarkDone={handleMarkDone}
                    onClick={() => {
                      if (task.is_personal) {
                        setSelectedPersonalTask(task)
                      } else {
                        navigate(`/projects/${task.project_id}?task=${task.id}`)
                      }
                    }}
                  />
                ))}
                {myTasks.length === 8 && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', textAlign: 'center', marginTop: '0.75rem' }}>
                    + more tasks across your projects
                  </p>
                )}
              </>
            )}
          </div>

          {/* My Personal Tasks */}
          <div className="card" style={{ borderColor: 'rgba(192, 132, 252, 0.3)' }}>
            <div className="flex-between mb-4">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>My Personal Tasks</h3>
                <span className="badge badge-personal">Personal</span>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowAddPersonal(!showAddPersonal)}>
                {showAddPersonal ? 'Cancel' : '+ Add'}
              </button>
            </div>

            {showAddPersonal && (
              <form onSubmit={handleAddPersonalTask} style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--gray-50)', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Task title..."
                    value={personalForm.title}
                    onChange={e => setPersonalForm({ ...personalForm, title: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>Priority</label>
                    <select
                      className="form-input form-select"
                      style={{ padding: '0.25rem 0.5rem', height: 'auto' }}
                      value={personalForm.priority}
                      onChange={e => setPersonalForm({ ...personalForm, priority: e.target.value })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '11px' }}>Start Date</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ padding: '0.25rem 0.5rem', height: 'auto' }}
                      value={personalForm.start_date}
                      onChange={e => setPersonalForm({ ...personalForm, start_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '11px' }}>Due Date</label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ padding: '0.25rem 0.5rem', height: 'auto' }}
                    value={personalForm.due_date}
                    onChange={e => setPersonalForm({ ...personalForm, due_date: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn btn-sm btn-primary" style={{ alignSelf: 'flex-end' }}>
                  Create Task
                </button>
              </form>
            )}

            {personalLoading ? (
              <div className="page-loading" style={{ minHeight: 100 }}>
                <div className="spinner spinner-dark" />
              </div>
            ) : personalTasks.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem 0' }}>
                <p className="empty-state-title" style={{ fontSize: 'var(--text-sm)' }}>No personal tasks</p>
                <p className="empty-state-desc" style={{ fontSize: 'var(--text-xs)' }}>Create private tasks here to manage your own to-do list.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {personalTasks.map(task => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date()
                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedPersonalTask(task)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.5rem var(--space-2)', borderBottom: '1px solid var(--gray-100)',
                        borderRadius: 'var(--radius)', cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-50)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMarkDone(task.id, true)
                        }}
                        style={{
                          width: 18, height: 18, borderRadius: '50%',
                          border: '2px solid #c084fc',
                          background: 'transparent', cursor: 'pointer', flexShrink: 0,
                          transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={e => { e.target.style.background = '#f3e8ff' }}
                        onMouseLeave={e => { e.target.style.background = 'transparent' }}
                        title="Mark as done"
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="truncate" style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--gray-800)' }}>
                          {task.title}
                        </p>
                        {task.due_date && (
                          <p style={{ fontSize: '11px', color: isOverdue ? 'var(--danger)' : 'var(--gray-400)', marginTop: 2, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            {isOverdue ? <AlertTriangle size={10} /> : <Calendar size={10} />}
                            <span>{new Date(task.due_date).toLocaleDateString()}</span>
                          </p>
                        )}
                      </div>
                      <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Projects */}
        <div className="card">
          <div className="flex-between mb-4">
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Recent Projects</h3>
            {(isAdmin || isManager) && (
              <button className="btn btn-sm btn-primary" onClick={() => navigate('/projects')} id="go-to-projects-btn">
                + New
              </button>
            )}
          </div>
          {loading ? (
            <div className="page-loading" style={{ minHeight: 120 }}>
              <div className="spinner spinner-dark" />
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 0' }}>
              <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
                <FolderKanban size={48} style={{ color: 'var(--gray-300)', marginBottom: '0.5rem' }} />
              </div>
              <p className="empty-state-title">No projects yet</p>
              {(isAdmin || isManager) && (
                <button className="btn btn-primary" onClick={() => navigate('/projects')}>
                  Create your first project
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentProjects.map(p => (
                <div
                  key={p.id}
                  id={`project-card-${p.id}`}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem', borderRadius: 'var(--radius)',
                    border: '1px solid var(--gray-100)', cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-50)'; e.currentTarget.style.borderColor = 'var(--brand-200)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-100)' }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: statusColor[p.status] || 'var(--gray-400)'
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="truncate" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-800)' }}>
                      {p.name}
                    </p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
                      {p.status.replace('_', ' ')}
                    </p>
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-300)' }}>›</span>
                </div>
              ))}
              <button className="btn btn-ghost" style={{ width: '100%', marginTop: '0.25rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }} onClick={() => navigate('/projects')}>
                <span>View all projects</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>


      {/* Role info card */}
      <div style={{
        marginTop: 'var(--space-6)',
        padding: 'var(--space-4) var(--space-5)',
        background: 'var(--brand-50)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--brand-100)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)'
      }}>
        <Lock size={20} style={{ color: 'var(--brand-600)', flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--brand-800)' }}>
            Your account is secure — role: <span style={{ textTransform: 'capitalize' }}>{user?.role}</span>
          </p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--brand-600)', marginTop: 2 }}>
            All files encrypted · Session protected · Activity logged
          </p>
        </div>
      </div>

      {selectedPersonalTask && (
        <PersonalTaskDetailDrawer
          task={selectedPersonalTask}
          onClose={() => setSelectedPersonalTask(null)}
          onUpdate={handleUpdatePersonalTask}
          onDelete={handleDeletePersonalTask}
        />
      )}
    </Layout>
  )
}
