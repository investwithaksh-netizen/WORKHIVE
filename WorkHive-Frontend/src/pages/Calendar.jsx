import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import Layout from '../components/Layout'
import api from '../lib/api'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, AlertTriangle, ExternalLink } from 'lucide-react'

export default function CalendarPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [orgUsers, setOrgUsers] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)

  useEffect(() => {
    fetchTasks()
    fetchUsers()
  }, [])

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const [tasksRes, personalRes] = await Promise.all([
        api.get('/api/v1/tasks'),
        api.get('/api/v1/tasks/personal')
      ])
      const merged = [
        ...tasksRes.data,
        ...personalRes.data.map(t => ({ ...t, is_personal: true }))
      ]
      setTasks(merged)
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/v1/users/org')
      setOrgUsers(res.data)
    } catch {}
  }

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  // Helper arrays for calendar generation
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // First day of current month (0 = Sun, 1 = Mon...)
  const firstDayIndex = new Date(year, month, 1).getDay()
  // Total days in current month
  const totalDays = new Date(year, month + 1, 0).getDate()
  // Total days in previous month (for leading buffer)
  const prevTotalDays = new Date(year, month, 0).getDate()

  // Generate calendar days grid
  const daysGrid = []
  
  // 1. Prev month buffer
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    daysGrid.push({
      day: prevTotalDays - i,
      month: month === 0 ? 11 : month - 1,
      year: month === 0 ? year - 1 : year,
      isCurrentMonth: false
    })
  }

  // 2. Current month days
  for (let i = 1; i <= totalDays; i++) {
    daysGrid.push({
      day: i,
      month: month,
      year: year,
      isCurrentMonth: true
    })
  }

  // 3. Next month buffer to complete grid (multiples of 7, usually 35 or 42 cells)
  const totalCells = daysGrid.length <= 35 ? 35 : 42
  const nextMonthBuffer = totalCells - daysGrid.length
  for (let i = 1; i <= nextMonthBuffer; i++) {
    daysGrid.push({
      day: i,
      month: month === 11 ? 0 : month + 1,
      year: month === 11 ? year + 1 : year,
      isCurrentMonth: false
    })
  }

  // Priority color styling
  const priorityColors = {
    low: { bg: 'var(--success-light)', text: 'var(--success-dark)', border: 'var(--success)' },
    medium: { bg: 'var(--warning-light)', text: 'var(--warning-dark)', border: 'var(--warning)' },
    high: { bg: '#ffedd5', text: '#c2410c', border: '#f97316' },
    urgent: { bg: 'var(--danger-light)', text: 'var(--danger-dark)', border: 'var(--danger)' }
  }

  // Filter tasks mapping
  const filteredTasks = tasks.filter(t => {
    if (!t.due_date) return false
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority
    const matchesAssignee = filterAssignee === 'all' ||
      (filterAssignee === 'unassigned' && (!t.assignees || t.assignees.length === 0)) ||
      (t.assignees && t.assignees.some(a => a.id === filterAssignee))
    return matchesPriority && matchesAssignee
  })

  // Get tasks for a specific date cell
  const getTasksForDate = (cellDate) => {
    const yyyy = cellDate.year
    const mm = String(cellDate.month + 1).padStart(2, '0')
    const dd = String(cellDate.day).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`
    
    return filteredTasks.filter(task => {
      const startRaw = task.start_date || task.created_at
      const endRaw = task.due_date
      
      const startStr = startRaw.substring(0, 10)
      const endStr = endRaw.substring(0, 10)
      const todayStr = new Date().toISOString().substring(0, 10)
      
      // Normal range: start_date to due_date
      const inRange = dateStr >= startStr && dateStr <= endStr
      
      // Overdue range: from due_date + 1 to today (if not done)
      const isOverdue = dateStr > endStr && task.status !== 'done' && dateStr <= todayStr
      
      return inRange || isOverdue
    })
  }

  return (
    <Layout title="Calendar Scheduler">
      {/* Filters bar */}
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
          <label htmlFor="cal-priority-filter" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Priority</label>
          <select
            id="cal-priority-filter"
            className="form-input form-select"
            style={{ width: 'auto', padding: '0.25rem 2rem 0.25rem 0.5rem', height: '36px', fontSize: 'var(--text-xs)' }}
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label htmlFor="cal-assignee-filter" style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Assignee</label>
          <select
            id="cal-assignee-filter"
            className="form-input form-select"
            style={{ width: 'auto', padding: '0.25rem 2rem 0.25rem 0.5rem', height: '36px', fontSize: 'var(--text-xs)' }}
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
          >
            <option value="all">All Assignees</option>
            <option value="unassigned">Unassigned</option>
            {orgUsers.map(u => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Calendar Header with Navigation */}
      <div className="flex-between" style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 40, height: 40, borderRadius: 'var(--radius)',
            background: 'var(--brand-50)', color: 'var(--brand-600)'
          }}>
            <CalendarIcon size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--gray-900)' }}>
              {monthNames[month]} {year}
            </h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
              Viewing {filteredTasks.length} tasks scheduled this month
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={prevMonth} style={{ padding: '0.375rem' }} title="Previous Month">
            <ChevronLeft size={18} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setCurrentDate(new Date())} style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
            Today
          </button>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth} style={{ padding: '0.375rem' }} title="Next Month">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div style={{ overflowX: 'auto', width: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--gray-150)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{
          background: 'var(--surface-card)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '650px',
          minWidth: '700px'
        }}>
          {/* Day Name Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: '1px solid var(--gray-150)',
            background: 'var(--gray-50)',
            textAlign: 'center',
            fontWeight: 600,
            fontSize: 'var(--text-xs)',
            color: 'var(--gray-500)',
            padding: '0.75rem 0'
          }}>
            {dayNames.map(day => <div key={day}>{day}</div>)}
          </div>

          {/* Days Grid */}
          {loading ? (
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <div className="spinner spinner-dark" />
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gridAutoRows: 'minmax(100px, 1fr)',
              flex: 1
            }}>
              {daysGrid.map((cell, idx) => {
                const cellTasks = getTasksForDate(cell)
                const isToday = new Date().getDate() === cell.day &&
                  new Date().getMonth() === cell.month &&
                  new Date().getFullYear() === cell.year

                return (
                  <div
                    key={idx}
                    style={{
                      borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--gray-150)',
                      borderBottom: idx >= daysGrid.length - 7 ? 'none' : '1px solid var(--gray-150)',
                      background: cell.isCurrentMonth ? 'transparent' : 'var(--gray-50)',
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 0,
                      position: 'relative',
                      transition: 'background var(--transition-fast)'
                    }}
                  >
                    {/* Day label */}
                    <div style={{
                      alignSelf: 'flex-start',
                      fontSize: 'var(--text-xs)',
                      fontWeight: isToday ? 800 : 500,
                      color: isToday ? 'white' : cell.isCurrentMonth ? 'var(--gray-800)' : 'var(--gray-400)',
                      background: isToday ? 'var(--brand-600)' : 'transparent',
                      width: isToday ? 22 : 'auto',
                      height: isToday ? 22 : 'auto',
                      borderRadius: isToday ? '50%' : 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '0.375rem',
                    }}>
                      {cell.day}
                    </div>

                    {/* Task list container */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                      {cellTasks.map(task => {
                        const colors = priorityColors[task.priority] || priorityColors.medium
                        const cellDateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
                        const dueStr = task.due_date ? task.due_date.substring(0, 10) : ''
                        const isCellOverdue = task.due_date && cellDateStr > dueStr && task.status !== 'done'

                        return (
                          <div
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className={`${isCellOverdue ? 'calendar-task-overdue' : ''} ${task.is_personal ? 'calendar-task-personal' : ''}`}
                            style={{
                              background: task.is_personal ? 'rgba(192, 132, 252, 0.1)' : colors.bg,
                              color: task.is_personal ? '#9333ea' : colors.text,
                              borderLeft: `3px solid ${task.is_personal ? '#c084fc' : colors.border}`,
                              padding: '0.25rem 0.375rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              transition: 'transform var(--transition-fast)'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}
                            title={`${task.title} (Priority: ${task.priority})${task.is_personal ? ' - Personal' : ''}${isCellOverdue ? ' - OVERDUE' : ''}`}
                          >
                            {task.is_personal && <span style={{ marginRight: '2px' }}>🔒</span>}
                            {task.title}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Task Quick-View Modal */}
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="modal" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Task Scheduler Details</h3>
              <button className="btn-icon" onClick={() => setSelectedTask(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--gray-900)' }}>
                  {selectedTask.is_personal && <span style={{ marginRight: '4px' }}>🔒</span>}
                  {selectedTask.title}
                </h4>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {selectedTask.start_date && (
                    <span>Start Date: {new Date(selectedTask.start_date).toLocaleDateString(undefined, { dateStyle: 'full' })}</span>
                  )}
                  <span>Due Date: {new Date(selectedTask.due_date).toLocaleDateString(undefined, { dateStyle: 'full' })}</span>
                </p>
              </div>

              {selectedTask.description && (
                <div>
                  <h5 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Description</h5>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)', background: 'var(--gray-50)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', marginTop: '0.25rem' }}>
                    {selectedTask.description}
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <h5 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Priority</h5>
                  <span className={`badge badge-${selectedTask.priority}`} style={{ marginTop: '0.25rem', display: 'inline-block' }}>
                    {selectedTask.priority}
                  </span>
                </div>
                <div>
                  <h5 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Status</h5>
                  <span className={`badge badge-${selectedTask.status}`} style={{ marginTop: '0.25rem', display: 'inline-block' }}>
                    {selectedTask.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {selectedTask.assignees && selectedTask.assignees.length > 0 ? (
                <div>
                  <h5 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Assignees</h5>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    {selectedTask.assignees.map(a => (
                      <div key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: 'var(--gray-100)', borderRadius: 'var(--radius-sm)' }}>
                        <span className="avatar-xs">
                          {a.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--gray-700)' }}>{a.full_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                selectedTask.assigned_to_name && (
                  <div>
                    <h5 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Assignee</h5>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-700)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                      <span style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--brand-500), var(--brand-300))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 700, color: 'white'
                      }}>
                        {selectedTask.assigned_to_name.charAt(0).toUpperCase()}
                      </span>
                      <span>{selectedTask.assigned_to_name}</span>
                    </p>
                  </div>
                )
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedTask(null)}>
                Close
              </button>
              {!selectedTask.is_personal && selectedTask.project_id && (
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(`/projects/${selectedTask.project_id}?task=${selectedTask.id}`)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <ExternalLink size={14} />
                  <span>Go to Project Board</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
