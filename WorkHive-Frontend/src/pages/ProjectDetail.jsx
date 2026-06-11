import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import Layout from '../components/Layout'
import api from '../lib/api'
import { Folder, FolderOpen, Upload, Calendar, AlertTriangle, MessageSquare, ArrowLeft, X, Image, FileText, FileSpreadsheet, Paperclip, Receipt, Palette, Plus, LayoutGrid, Check, AlertCircle, Clock, ShieldCheck, Trash2 } from 'lucide-react'

// ── File auto-tag heuristic ────────────────────────────────────────────────
function autoTag(filename) {
  const name = filename.toLowerCase()
  if (/invoice|bill|receipt|payment/.test(name)) return { label: 'Invoice', icon: Receipt, color: '#fef9c3', text: '#a16207' }
  if (/contract|agreement|nda|terms/.test(name)) return { label: 'Contract', icon: FileText, color: '#fee2e2', text: '#b91c1c' }
  if (/design|mockup|wireframe|figma|sketch|ui|ux/.test(name)) return { label: 'Design', icon: Palette, color: '#ede9fe', text: '#6d28d9' }
  if (/photo|img|image|jpeg|jpg|png|gif|webp/.test(name)) return { label: 'Photo', icon: Image, color: '#dbeafe', text: '#1d4ed8' }
  if (/report|summary|analysis|data/.test(name)) return { label: 'Report', icon: FileSpreadsheet, color: '#dcfce7', text: '#15803d' }
  return { label: 'File', icon: Folder, color: '#f1f5f9', text: '#475569' }
}

// ── Sub-components ─────────────────────────────────────────────────────────
function CreateTaskModal({ projectId, orgUsers, onClose, onCreate }) {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium', assignee_ids: [], due_date: '', start_date: '', estimated_hours: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = {
        project_id: projectId,
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        assignee_ids: form.assignee_ids,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
      }
      const res = await api.post('/api/v1/tasks', payload)
      onCreate(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">New Task</h3>
          <button className="btn-icon" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
        </div>
        <form id="create-task-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label" htmlFor="task-title">Task title *</label>
              <input id="task-title" className="form-input" value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="What needs to be done?" required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="task-desc">Description</label>
              <textarea id="task-desc" className="form-input form-textarea"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Optional details..." rows={3} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="task-priority">Priority</label>
                <select id="task-priority" className="form-input form-select"
                  value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="task-hours">Est. hours</label>
                <input id="task-hours" type="number" min="0" step="0.5" className="form-input"
                  value={form.estimated_hours}
                  onChange={e => setForm({ ...form, estimated_hours: e.target.value })}
                  placeholder="0" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Assign to</label>
              <div className="multi-select-container">
                <div
                  className="form-input"
                  onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '40px', flexWrap: 'wrap', gap: '4px', padding: '6px 12px' }}
                >
                  {form.assignee_ids.length === 0 ? (
                    <span style={{ color: 'var(--gray-400)' }}>Select assignees...</span>
                  ) : (
                    form.assignee_ids.map(uid => {
                      const u = orgUsers.find(u => u.id === uid)
                      return u ? (
                        <span key={uid} className="badge" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px' }}>
                          {u.full_name}
                          <span onClick={(e) => { e.stopPropagation(); setForm(f => ({...f, assignee_ids: f.assignee_ids.filter(id => id !== uid)})) }} style={{ cursor: 'pointer', fontWeight: 700 }}>×</span>
                        </span>
                      ) : null
                    })
                  )}
                  <span style={{ fontSize: '10px', color: 'var(--gray-400)' }}>▼</span>
                </div>
                {showAssigneeDropdown && (
                  <div className="multi-select-dropdown" style={{ width: '100%' }}>
                    {orgUsers.map(u => (
                      <label key={u.id} className="multi-select-option" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={form.assignee_ids.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm(f => ({...f, assignee_ids: [...f.assignee_ids, u.id]}))
                            } else {
                              setForm(f => ({...f, assignee_ids: f.assignee_ids.filter(id => id !== u.id)}))
                            }
                          }}
                        />
                        <span>{u.full_name}</span>
                        <span style={{ color: 'var(--gray-400)', fontSize: '11px' }}>({u.role})</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="task-start">Start date</label>
                <input id="task-start" type="date" className="form-input"
                  value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="task-due">Due date</label>
                <input id="task-due" type="date" className="form-input"
                  value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
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
            <button id="create-task-submit" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TaskDetailDrawer({ task, onClose, onStatusChange, onUpdate, onDelete, currentUser, orgUsers, showToast }) {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    priority: task.priority,
    assignee_ids: task.assignees ? task.assignees.map(a => a.id) : (task.assigned_to ? [task.assigned_to] : []),
    due_date: task.due_date ? task.due_date.substring(0, 10) : '',
    start_date: task.start_date ? task.start_date.substring(0, 10) : '',
    estimated_hours: task.estimated_hours || ''
  })
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [error, setError] = useState('')
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingCommentText, setEditingCommentText] = useState('')

  const handleEditComment = async (commentId) => {
    if (!editingCommentText.trim()) return
    try {
      const res = await api.put(`/api/v1/tasks/${task.id}/comments/${commentId}`, { body: editingCommentText })
      setComments(prev => prev.map(c => c.id === commentId ? res.data : c))
      setEditingCommentId(null)
      setEditingCommentText('')
      if (showToast) showToast('Comment updated successfully!')
    } catch (err) {
      if (showToast) showToast(err.response?.data?.detail || 'Failed to edit comment', 'error')
    }
  }

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to permanently delete this comment?")) return
    try {
      await api.delete(`/api/v1/tasks/${task.id}/comments/${commentId}`)
      setComments(prev => prev.filter(c => c.id !== commentId))
      if (showToast) showToast('Comment deleted successfully!')
    } catch (err) {
      if (showToast) showToast(err.response?.data?.detail || 'Failed to delete comment', 'error')
    }
  }

  useEffect(() => {
    if (!task) return
    api.get(`/api/v1/tasks/${task.id}/comments`)
      .then(r => setComments(r.data))
      .catch(() => {})
      
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      assignee_ids: task.assignees ? task.assignees.map(a => a.id) : (task.assigned_to ? [task.assigned_to] : []),
      due_date: task.due_date ? task.due_date.substring(0, 10) : '',
      start_date: task.start_date ? task.start_date.substring(0, 10) : '',
      estimated_hours: task.estimated_hours || ''
    })
    setIsEditing(false)
    setShowAssigneeDropdown(false)
    setError('')
  }, [task?.id])

  const submitComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return
    setSubmitting(true)
    try {
      const res = await api.post(`/api/v1/tasks/${task.id}/comments`, { body: newComment })
      setComments(prev => [...prev, res.data])
      setNewComment('')
    } catch { /* silent */ }
    setSubmitting(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaveLoading(true)
    setError('')
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        assignee_ids: form.assignee_ids,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
        estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null
      }
      const res = await api.put(`/api/v1/tasks/${task.id}`, payload)
      onUpdate(res.data)
      setIsEditing(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update task')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this task? This cannot be undone.")) return
    try {
      await api.delete(`/api/v1/tasks/${task.id}`)
      onDelete(task.id)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete task')
    }
  }

  if (!task) return null

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
  const canEdit = ['L1', 'L2'].includes(currentUser?.role) || task.created_by === currentUser?.id

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end'
    }}>
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
           onClick={onClose} />
      <div style={{
        width: 460, background: 'var(--surface-card)',
        display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
        animation: 'slideUp var(--transition)',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            {isEditing ? (
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--gray-900)' }}>Edit Task</h3>
            ) : (
              <>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                  {task.title}
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                  <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
                </div>
              </>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            {canEdit && !isEditing && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditing(true)}
                style={{ padding: '0.25rem 0.5rem' }}
              >
                Edit
              </button>
            )}
            {canEdit && isEditing && (
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
                <label className="form-label" htmlFor="edit-task-title">Title *</label>
                <input
                  id="edit-task-title"
                  className="form-input"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label" htmlFor="edit-task-desc">Description</label>
                <textarea
                  id="edit-task-desc"
                  className="form-input form-textarea"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-task-priority">Priority</label>
                  <select
                    id="edit-task-priority"
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
                  <label className="form-label" htmlFor="edit-task-hours">Est. hours</label>
                  <input
                    id="edit-task-hours"
                    type="number"
                    min="0"
                    step="0.5"
                    className="form-input"
                    value={form.estimated_hours}
                    onChange={e => setForm({ ...form, estimated_hours: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Assign to</label>
                <div className="multi-select-container">
                  <div
                    className="form-input"
                    onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '40px', flexWrap: 'wrap', gap: '4px', padding: '6px 12px' }}
                  >
                    {form.assignee_ids.length === 0 ? (
                      <span style={{ color: 'var(--gray-400)' }}>Select assignees...</span>
                    ) : (
                      form.assignee_ids.map(uid => {
                        const u = orgUsers.find(u => u.id === uid)
                        return u ? (
                          <span key={uid} className="badge" style={{ background: 'var(--brand-100)', color: 'var(--brand-700)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px' }}>
                            {u.full_name}
                            <span onClick={(e) => { e.stopPropagation(); setForm(f => ({...f, assignee_ids: f.assignee_ids.filter(id => id !== uid)})) }} style={{ cursor: 'pointer', fontWeight: 700 }}>×</span>
                          </span>
                        ) : null
                      })
                    )}
                    <span style={{ fontSize: '10px', color: 'var(--gray-400)' }}>▼</span>
                  </div>
                  {showAssigneeDropdown && (
                    <div className="multi-select-dropdown" style={{ width: '100%' }}>
                      {orgUsers.map(u => (
                        <label key={u.id} className="multi-select-option" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={form.assignee_ids.includes(u.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForm(f => ({...f, assignee_ids: [...f.assignee_ids, u.id]}))
                              } else {
                                setForm(f => ({...f, assignee_ids: f.assignee_ids.filter(id => id !== u.id)}))
                              }
                            }}
                          />
                          <span>{u.full_name}</span>
                          <span style={{ color: 'var(--gray-400)', fontSize: '11px' }}>({u.role})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-task-start">Start date</label>
                  <input
                    id="edit-task-start"
                    type="date"
                    className="form-input"
                    value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-task-due">Due date</label>
                  <input
                    id="edit-task-due"
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
                  Delete Task
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
              {task.description && (
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Description
                  </p>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{task.description}</p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Assigned to</p>
                  {task.assignees && task.assignees.length > 0 ? (
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {task.assignees.map(a => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: 'var(--gray-100)', borderRadius: 'var(--radius-sm)' }}>
                          <span className="avatar-xs">
                            {a.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--gray-700)' }}>{a.full_name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>Unassigned</p>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Dates</p>
                  <p style={{ fontSize: 'var(--text-sm)', color: isOverdue ? 'var(--danger)' : 'var(--gray-700)', fontWeight: isOverdue ? 600 : 500, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {task.start_date && (
                      <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Start: {new Date(task.start_date).toLocaleDateString()}</span>
                    )}
                    <span>Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}</span>
                    {isOverdue && <span style={{ color: 'var(--danger)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}><AlertTriangle size={12} /> Overdue</span>}
                  </p>
                </div>
                {task.estimated_hours && (
                  <div>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Est. hours</p>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-700)', fontWeight: 500 }}>{task.estimated_hours}h</p>
                  </div>
                )}
              </div>

              {/* Status change */}
              <div className="form-group">
                <label className="form-label" htmlFor="drawer-status-select">Move to</label>
                <select id="drawer-status-select" className="form-input form-select" value={task.status}
                  onChange={e => onStatusChange(task.id, e.target.value)}>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="done">Done</option>
                </select>
              </div>

              {/* Comments */}
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                  <MessageSquare size={16} />
                  <span>Comments ({comments.length})</span>
                </p>
                <div className="activity-feed" style={{ marginBottom: '1rem', maxHeight: '240px', overflowY: 'auto' }}>
                  {comments.length === 0 ? (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-400)', textAlign: 'center', padding: '1rem 0' }}>
                      No comments yet. Be the first!
                    </p>
                  ) : comments.map(c => {
                    const isEditingThisComment = editingCommentId === c.id
                    const canEditComment = c.author_id === currentUser?.id
                    const canDeleteComment = ['L1', 'L2'].includes(currentUser?.role) || c.author_id === currentUser?.id

                    return (
                      <div key={c.id} className="activity-item" style={{ alignItems: 'flex-start' }}>
                        <div className="activity-avatar">
                          {c.author_name.split(' ').map(p => p[0]).join('').slice(0, 2)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.25rem' }}>
                            {c.author_name}
                          </p>
                          
                          {isEditingThisComment ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <textarea
                                className="form-input form-textarea"
                                value={editingCommentText}
                                onChange={e => setEditingCommentText(e.target.value)}
                                style={{ padding: '6px 8px', fontSize: 'var(--text-sm)', minHeight: '60px' }}
                                autoFocus
                              />
                              <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setEditingCommentId(null)}
                                  style={{ padding: '2px 8px', fontSize: '11px', height: 'auto' }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleEditComment(c.id)}
                                  style={{ padding: '2px 8px', fontSize: '11px', height: 'auto' }}
                                  disabled={!editingCommentText.trim()}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="activity-text" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.body}</p>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                <span className="activity-time" style={{ margin: 0 }}>{new Date(c.created_at).toLocaleString()}</span>
                                {canEditComment && (
                                  <>
                                    <span style={{ fontSize: '10px', color: 'var(--gray-300)' }}>•</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCommentId(c.id)
                                        setEditingCommentText(c.body)
                                      }}
                                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '10px', color: 'var(--brand-600)', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                      Edit
                                    </button>
                                  </>
                                )}
                                {canDeleteComment && (
                                  <>
                                    <span style={{ fontSize: '10px', color: 'var(--gray-300)' }}>•</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(c.id)}
                                      style={{ background: 'none', border: 'none', padding: 0, fontSize: '10px', color: 'var(--danger)', cursor: 'pointer', fontWeight: 500 }}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <form onSubmit={submitComment} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    aria-label="Add a comment"
                    className="form-input"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !newComment.trim()}>
                    {submitting ? '…' : 'Post'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EditProjectModal({ project, onClose, onUpdate }) {
  const [form, setForm] = useState({
    name: project.name,
    description: project.description || '',
    status: project.status,
    due_date: project.due_date ? project.due_date.substring(0, 10) : ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        status: form.status,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null
      }
      const res = await api.put(`/api/v1/projects/${project.id}`, payload)
      onUpdate(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update project')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">Edit Project</h3>
          <button className="btn-icon" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label" htmlFor="edit-proj-name">Project name *</label>
              <input id="edit-proj-name" className="form-input" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-proj-desc">Description</label>
              <textarea id="edit-proj-desc" className="form-input form-textarea"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-proj-status">Status</label>
              <select id="edit-proj-status" className="form-input form-select"
                value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-proj-due">Due date</label>
              <input id="edit-proj-due" type="date" className="form-input"
                value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
            {error && (
              <div className="alert alert-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const COLUMNS = [
  { id: 'todo',        label: 'To Do',      dot: 'var(--gray-400)' },
  { id: 'in_progress', label: 'In Progress', dot: 'var(--info)' },
  { id: 'in_review',  label: 'In Review',   dot: '#7c3aed' },
  { id: 'done',       label: 'Done',        dot: 'var(--success)' },
]

// ── Main component ─────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()

  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [files, setFiles] = useState([])
  const [orgUsers, setOrgUsers] = useState([])
  const [projectAccess, setProjectAccess] = useState([])
  const [loading, setLoading] = useState(true)
  const [accessLoading, setAccessLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('board')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showEditProject, setShowEditProject] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [taskSearch, setTaskSearch] = useState('')
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('all')
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState('all')
  const [grantForm, setGrantForm] = useState({ user_id: '', role: 'viewer' })
  const [toast, setToast] = useState(null)
  const fileInputRef = useRef()

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const canManage = ['L1', 'L2'].includes(user?.role)
  const isWorkspaceAdminOrManager = ['L1', 'L2'].includes(user?.role)

  useEffect(() => {
    fetchAll()
  }, [projectId])

  useEffect(() => {
    if (tasks.length > 0) {
      const queryParams = new URLSearchParams(location.search)
      const taskId = queryParams.get('task')
      if (taskId) {
        const foundTask = tasks.find(t => t.id === taskId)
        if (foundTask) {
          setSelectedTask(foundTask)
        }
      }
    }
  }, [tasks, location.search])

  const fetchAll = async () => {
    try {
      const [projRes, tasksRes, filesRes, usersRes] = await Promise.all([
        api.get(`/api/v1/projects/${projectId}`),
        api.get(`/api/v1/tasks/project/${projectId}`),
        api.get(`/api/v1/files/project/${projectId}`).catch(() => ({ data: [] })),
        api.get('/api/v1/users/org').catch(() => ({ data: [] })),
      ])
      setProject(projRes.data)
      setTasks(tasksRes.data)
      setFiles(filesRes.data)
      setOrgUsers(usersRes.data)
      
      if (isWorkspaceAdminOrManager) {
        fetchAccess()
      }
    } catch (err) {
      console.error('Failed to load project:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAccess = async () => {
    setAccessLoading(true)
    try {
      const res = await api.get(`/api/v1/projects/${projectId}/access`)
      setProjectAccess(res.data)
    } catch { /* silent */ }
    setAccessLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'access' && project) {
      fetchAccess()
    }
  }, [activeTab])

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.put(`/api/v1/tasks/${taskId}`, { status: newStatus })
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => ({ ...prev, status: newStatus }))
      }
    } catch { /* silent */ }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post(`/api/v1/files/upload?project_id=${projectId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setFiles(prev => [res.data, ...prev])
      showToast('File uploaded successfully!')
    } catch (err) {
      showToast(err.response?.data?.detail || 'File upload failed. Make sure you have connected Google Drive.', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileDelete = async (fileId) => {
    if (!window.confirm("Are you sure you want to permanently delete this file? It will be removed from Google Drive.")) return
    try {
      await api.delete(`/api/v1/files/${fileId}`)
      setFiles(prev => prev.filter(f => f.id !== fileId))
      showToast("File deleted successfully", "success")
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to delete file", "error")
    }
  }

  const handleDeleteProject = async () => {
    if (!window.confirm("WARNING: Are you sure you want to permanently delete this project? All associated tasks, comments, files, and chat rooms will be permanently deleted.")) return
    try {
      await api.delete(`/api/v1/projects/${projectId}`)
      showToast("Project deleted successfully", "success")
      setTimeout(() => navigate('/projects'), 1000)
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to delete project", "error")
    }
  }

  const handleGrantAccess = async (e) => {
    e.preventDefault()
    if (!grantForm.user_id) return
    try {
      await api.post(`/api/v1/projects/${projectId}/access`, {
        user_id: grantForm.user_id,
        role: grantForm.role
      })
      setGrantForm({ user_id: '', role: 'viewer' })
      fetchAccess()
      showToast('Project access updated successfully!')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to grant project access', 'error')
    }
  }

  const handleRevokeAccess = async (targetUserId) => {
    try {
      await api.delete(`/api/v1/projects/${projectId}/access/${targetUserId}`)
      fetchAccess()
      showToast('Project access revoked successfully!')
    } catch (err) {
      showToast('Failed to revoke access', 'error')
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <Layout title="Loading...">
        <div style={{ marginBottom: 'var(--space-6)' }}>
          {/* Back button skeleton */}
          <div className="animate-pulse" style={{ width: 100, height: 16, background: 'var(--gray-150)', borderRadius: 4, marginBottom: '0.75rem' }} />
          
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            {/* Title & description skeleton */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="animate-pulse" style={{ width: 220, height: 32, background: 'var(--gray-150)', borderRadius: 4 }} />
                <div className="animate-pulse" style={{ width: 80, height: 20, background: 'var(--gray-100)', borderRadius: '999px' }} />
              </div>
              <div className="animate-pulse" style={{ width: '40%', height: 16, background: 'var(--gray-100)', borderRadius: 4, marginTop: '0.5rem' }} />
            </div>
            {/* Actions skeleton */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div className="animate-pulse" style={{ width: 90, height: 36, background: 'var(--gray-150)', borderRadius: 'var(--radius)' }} />
              <div className="animate-pulse" style={{ width: 90, height: 36, background: 'var(--gray-150)', borderRadius: 'var(--radius)' }} />
            </div>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="tabs" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="animate-pulse" style={{ width: 80, height: 32, background: 'var(--gray-150)', borderRadius: 4 }} />
          <div className="animate-pulse" style={{ width: 90, height: 32, background: 'var(--gray-100)', borderRadius: 4, marginLeft: 8 }} />
        </div>

        {/* Progress bar skeleton */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="animate-pulse" style={{ width: 120, height: 14, background: 'var(--gray-150)', borderRadius: 4 }} />
            <div className="animate-pulse" style={{ flex: 1, height: 8, background: 'var(--gray-100)', borderRadius: 4 }} />
          </div>
        </div>

        {/* Kanban board skeleton */}
        <div className="kanban-board">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="kanban-column">
              <div className="kanban-column-header">
                <div className="animate-pulse" style={{ width: 80, height: 16, background: 'var(--gray-150)', borderRadius: 4 }} />
                <div className="animate-pulse" style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--gray-100)' }} />
              </div>
              <div className="kanban-cards" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: 200 }}>
                {[1, 2].map(j => (
                  <div key={j} className="card animate-pulse" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ height: 16, background: 'var(--gray-150)', borderRadius: 4, width: '80%' }} />
                    <div style={{ height: 12, background: 'var(--gray-100)', borderRadius: 4, width: '40%' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                      <div style={{ width: 60, height: 18, borderRadius: 'var(--radius-sm)', background: 'var(--gray-100)' }} />
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--gray-100)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Layout>
    )
  }

  if (!project) {
    return (
      <Layout title="Not Found">
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
            <AlertCircle size={48} style={{ color: 'var(--gray-300)', marginBottom: '0.5rem' }} />
          </div>
          <p className="empty-state-title">Project not found</p>
          <button className="btn btn-primary" onClick={() => navigate('/projects')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <ArrowLeft size={16} />
            <span>Back to Projects</span>
          </button>
        </div>
      </Layout>
    )
  }

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(taskSearch.toLowerCase()))
    const matchesPriority = taskPriorityFilter === 'all' || t.priority === taskPriorityFilter
    const matchesAssignee = taskAssigneeFilter === 'all' ||
      (taskAssigneeFilter === 'unassigned' && (!t.assignees || t.assignees.length === 0)) ||
      (t.assignees && t.assignees.some(a => a.id === taskAssigneeFilter))
    return matchesSearch && matchesPriority && matchesAssignee
  })

  const tasksByStatus = (status) => filteredTasks.filter(t => t.status === status)
  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const detailTabs = [
    { key: 'board', label: 'Board', icon: LayoutGrid },
    { key: 'gantt', label: 'Gantt Timeline', icon: Clock },
    { key: 'files', label: `Files (${files.length})`, icon: Folder },
  ]
  if (isWorkspaceAdminOrManager) {
    detailTabs.push({ key: 'access', label: 'IAM & Access', icon: ShieldCheck })
  }

  // Filter org users to exclude creator and users who already have access
  const eligibleUsers = orgUsers.filter(u => 
    u.id !== project.created_by && 
    !projectAccess.some(a => a.user_id === u.id)
  )

  return (
    <Layout title={project.name}>
      {/* Project header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}
          style={{ marginBottom: '0.5rem', color: 'var(--gray-400)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <ArrowLeft size={14} />
          <span>All Projects</span>
        </button>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--gray-900)' }}>
                {project.name}
              </h2>
              <span className={`badge badge-${project.status}`} style={{ fontSize: '0.75rem' }}>
                {project.status.replace('_', ' ')}
              </span>
            </div>
            {project.description && (
              <p style={{ color: 'var(--gray-500)', fontSize: 'var(--text-sm)', marginTop: '0.25rem' }}>
                {project.description}
              </p>
            )}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {project.created_by_name && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>Created by:</span>
                  <strong style={{ color: 'var(--gray-600)' }}>{project.created_by_name}</strong>
                </span>
              )}
              {project.due_date && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>Due:</span>
                  <strong style={{ color: 'var(--gray-600)' }}>{new Date(project.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {canManage && (
              <button
                className="btn btn-secondary"
                onClick={() => setShowEditProject(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                Edit Project
              </button>
            )}
            {user?.role === 'L1' && (
              <button
                className="btn btn-secondary"
                onClick={handleDeleteProject}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--danger)', borderColor: '#fca5a5' }}
              >
                Delete
              </button>
            )}
            {canManage && (
              <button id="add-task-btn" className="btn btn-primary" onClick={() => setShowTaskModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Plus size={16} />
                <span>Add Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginTop: '1rem', maxWidth: 400 }}>
          <div className="flex-between" style={{ marginBottom: '0.375rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
              {doneTasks} of {totalTasks} tasks completed
            </span>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--brand-600)' }}>
              {progress}%
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {detailTabs.map(t => (
          <button key={t.key} id={`proj-tab-${t.key}`}
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <t.icon size={14} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Board tab ── */}
      {activeTab === 'board' && (
        <>
          {/* Task Search & Filter Controls */}
          <div style={{
            display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap',
            marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)',
            background: 'var(--surface-card)', borderRadius: 'var(--radius)',
            border: '1px solid var(--gray-100)'
          }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <input
                id="task-search-input"
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.25rem', height: '36px' }}
                placeholder="Search tasks..."
                value={taskSearch}
                onChange={e => setTaskSearch(e.target.value)}
              />
              <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', display: 'flex', alignItems: 'center' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label htmlFor="task-priority-filter" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-500)' }}>Priority:</label>
              <select
                id="task-priority-filter"
                className="form-input form-select"
                style={{ width: 'auto', padding: '0.25rem 2rem 0.25rem 0.5rem', height: '36px', fontSize: 'var(--text-xs)' }}
                value={taskPriorityFilter}
                onChange={e => setTaskPriorityFilter(e.target.value)}
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label htmlFor="task-assignee-filter" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-500)' }}>Assignee:</label>
              <select
                id="task-assignee-filter"
                className="form-input form-select"
                style={{ width: 'auto', padding: '0.25rem 2rem 0.25rem 0.5rem', height: '36px', fontSize: 'var(--text-xs)' }}
                value={taskAssigneeFilter}
                onChange={e => setTaskAssigneeFilter(e.target.value)}
              >
                <option value="all">All Assignees</option>
                <option value="unassigned">Unassigned</option>
                {orgUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="kanban-board">
          {COLUMNS.map(col => {
            const colTasks = tasksByStatus(col.id)
            return (
              <div key={col.id} className="kanban-column">
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <div className="kanban-column-dot" style={{ background: col.dot }} />
                    {col.label}
                  </div>
                  <span className="kanban-count">{colTasks.length}</span>
                </div>
                <div className="kanban-cards">
                  {colTasks.length === 0 && (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--gray-400)', fontSize: 'var(--text-xs)', fontStyle: 'italic' }}>
                      No tasks
                    </div>
                  )}
                  {colTasks.map(task => {
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
                    return (
                      <div key={task.id} id={`task-card-${task.id}`} className="task-card"
                        onClick={() => setSelectedTask(task)}>
                        {/* Priority strip */}
                        <div style={{
                          height: 3, borderRadius: '4px 4px 0 0', marginBottom: '0.625rem',
                          marginTop: '-0.75rem', marginLeft: '-0.75rem', marginRight: '-0.75rem',
                          background: {
                            low: 'var(--success)', medium: 'var(--warning)',
                            high: '#f97316', urgent: 'var(--danger)'
                          }[task.priority] || 'var(--gray-200)'
                        }} />
                        <p className="task-card-title">{task.title}</p>
                        {task.description && (
                          <p className="task-card-desc">{task.description}</p>
                        )}
                        <div className="task-card-footer">
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                            {task.assignees && task.assignees.length > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                {task.assignees.slice(0, 3).map((a, idx) => (
                                  <div
                                    key={a.id}
                                    className="avatar-xs"
                                    style={{
                                      marginLeft: idx > 0 ? '-6px' : 0,
                                      border: '2px solid var(--surface-card)',
                                      zIndex: 3 - idx
                                    }}
                                    title={a.full_name}
                                  >
                                    {a.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                                  </div>
                                ))}
                                {task.assignees.length > 3 && (
                                  <span style={{ fontSize: '10px', color: 'var(--gray-500)', marginLeft: '4px' }}>+{task.assignees.length - 3}</span>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '10px', color: 'var(--gray-400)' }}>Unassigned</span>
                            )}
                            {task.due_date && (
                              <span style={{
                                fontSize: '10px',
                                color: isOverdue ? 'var(--danger)' : 'var(--gray-400)',
                                fontWeight: isOverdue ? 700 : 400,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.125rem'
                              }}>
                                {isOverdue && <AlertTriangle size={10} style={{ flexShrink: 0 }} />}
                                <span>{new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        </>
      )}

      {/* ── Gantt Chart tab ── */}
      {activeTab === 'gantt' && (
        <div className="card" style={{ padding: '1.5rem', overflowX: 'auto' }}>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: '1.25rem' }}>Project Timeline (Gantt Chart)</h3>
          
          {filteredTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 0' }}>
              <p className="empty-state-title">No tasks to display</p>
              <p className="empty-state-desc">Create tasks with due dates to visualize them on the timeline.</p>
            </div>
          ) : (
            <div style={{ minWidth: '700px' }}>
              {/* Gantt Header Timeline */}
              <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', borderBottom: '2px solid var(--gray-200)', paddingBottom: '0.5rem', fontWeight: 600, fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                <div>Task</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '1rem', position: 'relative' }}>
                  <span>Project Start</span>
                  <span>Timeline</span>
                  <span>Due Horizon</span>
                </div>
              </div>

              {/* Gantt Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                {filteredTasks.map((t, idx) => {
                  const createdDate = new Date(t.created_at)
                  const dueDate = t.due_date ? new Date(t.due_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                  
                  // Relative timeline calculation
                  const projectStart = project.created_at ? new Date(project.created_at) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                  const projectEnd = project.due_date ? new Date(project.due_date) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
                  
                  const totalSpan = Math.max(1, projectEnd.getTime() - projectStart.getTime())
                  const startOffset = Math.max(0, Math.min(95, ((createdDate.getTime() - projectStart.getTime()) / totalSpan) * 100))
                  const durationSpan = Math.max(5, Math.min(100 - startOffset, ((dueDate.getTime() - createdDate.getTime()) / totalSpan) * 100))

                  const colors = {
                    low: 'var(--success)',
                    medium: 'var(--warning)',
                    high: '#f97316',
                    urgent: 'var(--danger)'
                  }[t.priority] || 'var(--gray-400)'

                  return (
                    <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '250px 1fr', alignItems: 'center' }}>
                      <div
                        onClick={() => setSelectedTask(t)}
                        style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-800)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '1rem' }}
                        title={t.title}
                      >
                        {t.title}
                      </div>
                      <div style={{ background: 'var(--gray-50)', height: '24px', borderRadius: '4px', position: 'relative', width: '100%', border: '1px solid var(--gray-100)' }}>
                        <div
                          onClick={() => setSelectedTask(t)}
                          style={{
                            position: 'absolute',
                            left: `${startOffset}%`,
                            width: `${durationSpan}%`,
                            height: '100%',
                            background: colors,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0 0.5rem',
                            color: 'white',
                            fontSize: '9px',
                            fontWeight: 700,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            boxShadow: 'var(--shadow-sm)',
                            opacity: t.status === 'done' ? 0.5 : 0.9,
                            textDecoration: t.status === 'done' ? 'line-through' : 'none',
                            transition: 'opacity 0.2s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = 1 }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = t.status === 'done' ? 0.5 : 0.9 }}
                          title={`Created: ${createdDate.toLocaleDateString()} | Due: ${dueDate.toLocaleDateString()}`}
                        >
                          {t.priority.toUpperCase()} · {t.status.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Files tab ── */}
      {activeTab === 'files' && (
        <div>
          <div className="flex-between mb-4">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
              Files are stored securely in Google Drive.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                id="file-upload-input"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <button
                id="upload-file-btn"
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                {uploading ? (
                  <><span className="spinner" /> Uploading…</>
                ) : (
                  <>
                    <Upload size={14} />
                    <span>Upload File</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {files.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center' }}>
                  <FolderOpen size={48} style={{ color: 'var(--gray-300)', marginBottom: '0.5rem' }} />
                </div>
                <p className="empty-state-title">No files yet</p>
                <p className="empty-state-desc">Upload files to share them with your team. They're stored securely in Google Drive.</p>
                <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Upload size={14} />
                  <span>Upload First File</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Tag</th>
                    <th>Size</th>
                    <th>Scan</th>
                    <th>Uploaded</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(f => {
                    const tag = autoTag(f.filename)
                    return (
                      <tr key={f.id} id={`file-row-${f.id}`}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--gray-500)' }}>
                              {f.mime_type?.startsWith('image/') ? <Image size={18} /> :
                               f.mime_type === 'application/pdf' ? <FileText size={18} /> :
                               f.mime_type?.includes('spreadsheet') ? <FileSpreadsheet size={18} /> : <Paperclip size={18} />}
                            </span>
                            <div>
                              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-800)' }}>
                                {f.filename}
                              </p>
                              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>{f.mime_type}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge" style={{ background: tag.color, color: tag.text, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <tag.icon size={12} />
                            <span>{tag.label}</span>
                          </span>
                        </td>
                        <td style={{ color: 'var(--gray-500)', fontSize: 'var(--text-sm)' }}>
                          {formatSize(f.size_bytes)}
                        </td>
                        <td>
                          <span className={`badge ${f.is_malware_scanned ? 'badge-completed' : 'badge-on_hold'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            {f.is_malware_scanned ? (
                              <>
                                <Check size={12} strokeWidth={3} />
                                <span>Clean</span>
                              </>
                            ) : (
                              <>
                                <Clock size={12} />
                                <span>Pending</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td style={{ color: 'var(--gray-400)', fontSize: 'var(--text-xs)' }}>
                          {new Date(f.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            {f.download_url && (
                              <a href={f.download_url} target="_blank" rel="noreferrer"
                                className="btn btn-secondary btn-sm">
                                Download
                              </a>
                            )}
                            {(isWorkspaceAdminOrManager || f.uploaded_by === user?.id) && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleFileDelete(f.id)}
                                style={{ color: 'var(--danger)', borderColor: '#fca5a5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Delete file"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── IAM & Access Tab ── */}
      {activeTab === 'access' && isWorkspaceAdminOrManager && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
          {/* Access rights table */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <ShieldCheck size={18} style={{ color: 'var(--brand-600)' }} />
              <span>Current Access Policies</span>
            </h3>
            
            {accessLoading ? (
              <div className="page-loading" style={{ minHeight: 120 }}>
                <div className="spinner spinner-dark" />
              </div>
            ) : projectAccess.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 0' }}>
                <p className="empty-state-title">No explicit access rights</p>
                <p className="empty-state-desc">Only L1, L2, and the project creator can view this project. Use the form to grant access to L3 or clients.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Project Role</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectAccess.map(a => (
                      <tr key={a.user_id}>
                        <td>
                          <div>
                            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--gray-800)' }}>{a.full_name}</p>
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>{a.email}</p>
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge-${a.role}`}>
                            {a.role.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-icon"
                              onClick={() => handleRevokeAccess(a.user_id)}
                              title="Revoke Access"
                              style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Grant access form */}
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              Grant Project Access
            </h3>
            
            <form onSubmit={handleGrantAccess} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="grant-user">User</label>
                <select
                  id="grant-user"
                  className="form-input form-select"
                  value={grantForm.user_id}
                  onChange={e => setGrantForm({ ...grantForm, user_id: e.target.value })}
                  required
                >
                  <option value="">Select a team member...</option>
                  {eligibleUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="grant-role">Permission Role</label>
                <select
                  id="grant-role"
                  className="form-input form-select"
                  value={grantForm.role}
                  onChange={e => setGrantForm({ ...grantForm, role: e.target.value })}
                  required
                >
                  <option value="viewer">Viewer (Read-Only)</option>
                  <option value="editor">Editor (Create & Edit Tasks/Comments)</option>
                  <option value="manager">Manager (Full control, edit permissions)</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '0.25rem' }}
                disabled={eligibleUsers.length === 0}
              >
                Grant Access
              </button>
              
              {eligibleUsers.length === 0 && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', textAlign: 'center', marginTop: '0.25rem' }}>
                  All organisation members already have project rights.
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ── Modals / Drawers ── */}
      {showTaskModal && (
        <CreateTaskModal
          projectId={projectId}
          orgUsers={orgUsers}
          onClose={() => setShowTaskModal(false)}
          onCreate={(newTask) => setTasks(prev => [newTask, ...prev])}
        />
      )}

      {showEditProject && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditProject(false)}
          onUpdate={(updatedProj) => setProject(updatedProj)}
        />
      )}

      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          currentUser={user}
          orgUsers={orgUsers}
          onClose={() => {
            setSelectedTask(null)
            navigate(location.pathname, { replace: true })
          }}
          onStatusChange={handleStatusChange}
          onUpdate={(updatedTask) => {
            setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t))
            setSelectedTask(updatedTask)
          }}
          onDelete={(deletedTaskId) => {
            setTasks(prev => prev.filter(t => t.id !== deletedTaskId))
          }}
          showToast={showToast}
        />
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
