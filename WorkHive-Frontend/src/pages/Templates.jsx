import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import api from '../lib/api'
import { Plus, Trash2, Edit3, Search, Check, AlertCircle, Folder, FileText, X, Save } from 'lucide-react'

export default function Templates() {
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')

  // Form states
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [editCatId, setEditCatId] = useState(null)
  const [editCatName, setEditCatName] = useState('')
  const [editCatDesc, setEditCatDesc] = useState('')

  const [newTplTitle, setNewTplTitle] = useState('')
  const [newTplDesc, setNewTplDesc] = useState('')
  const [editTplId, setEditTplId] = useState(null)
  const [editTplTitle, setEditTplTitle] = useState('')
  const [editTplDesc, setEditTplDesc] = useState('')

  // Modal/Drawer controls
  const [showAddCat, setShowAddCat] = useState(false)
  const [showAddTpl, setShowAddTpl] = useState(false)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchCategories = async () => {
    try {
      const res = await api.get('/api/v1/categories')
      setCategories(res.data)
      if (res.data.length > 0 && !selectedCategory) {
        setSelectedCategory(res.data[0])
      } else if (selectedCategory) {
        // Refresh selected category reference
        const updatedSelected = res.data.find(c => c.id === selectedCategory.id)
        if (updatedSelected) {
          setSelectedCategory(updatedSelected)
        }
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to load categories', 'error')
    }
  }

  const fetchTemplates = async () => {
    if (!selectedCategory) return
    try {
      const res = await api.get(`/api/v1/templates?category_id=${selectedCategory.id}`)
      setTemplates(res.data)
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to load templates', 'error')
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await fetchCategories()
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [selectedCategory?.id])

  // Category Actions
  const handleAddCategory = async (e) => {
    e.preventDefault()
    if (!newCatName.trim()) return
    try {
      const res = await api.post('/api/v1/categories', {
        name: newCatName.trim(),
        description: newCatDesc.trim() || null
      })
      setCategories(prev => [...prev, res.data].sort((a,b) => a.name.localeCompare(b.name)))
      setNewCatName('')
      setNewCatDesc('')
      setShowAddCat(false)
      showToast('Category created successfully!')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create category', 'error')
    }
  }

  const handleUpdateCategory = async (e) => {
    e.preventDefault()
    if (!editCatName.trim()) return
    try {
      const res = await api.put(`/api/v1/categories/${editCatId}`, {
        name: editCatName.trim(),
        description: editCatDesc.trim() || null
      })
      setCategories(prev => prev.map(c => c.id === editCatId ? res.data : c).sort((a,b) => a.name.localeCompare(b.name)))
      if (selectedCategory?.id === editCatId) {
        setSelectedCategory(res.data)
      }
      setEditCatId(null)
      showToast('Category updated successfully!')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update category', 'error')
    }
  }

  const handleDeleteCategory = async (catId, catName) => {
    if (catName === 'General') {
      showToast("The default 'General' category cannot be deleted.", 'error')
      return
    }
    if (!window.confirm(`Are you sure you want to delete the category "${catName}"? Existing projects under this category will be reassigned to the "General" category.`)) {
      return
    }
    try {
      await api.delete(`/api/v1/categories/${catId}`)
      const updatedCats = categories.filter(c => c.id !== catId)
      setCategories(updatedCats)
      if (selectedCategory?.id === catId) {
        setSelectedCategory(updatedCats[0] || null)
      }
      showToast('Category deleted successfully!')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to delete category', 'error')
    }
  }

  // Template Actions
  const handleAddTemplate = async (e) => {
    e.preventDefault()
    if (!newTplTitle.trim() || !selectedCategory) return
    try {
      const res = await api.post('/api/v1/templates', {
        category_id: selectedCategory.id,
        title: newTplTitle.trim(),
        description: newTplDesc.trim() || null
      })
      setTemplates(prev => [res.data, ...prev])
      setNewTplTitle('')
      setNewTplDesc('')
      setShowAddTpl(false)
      showToast('Template task added successfully!')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to add template', 'error')
    }
  }

  const handleUpdateTemplate = async (e) => {
    e.preventDefault()
    if (!editTplTitle.trim() || !editTplId) return
    try {
      const res = await api.put(`/api/v1/templates/${editTplId}`, {
        title: editTplTitle.trim(),
        description: editTplDesc.trim() || null
      })
      setTemplates(prev => prev.map(t => t.id === editTplId ? res.data : t))
      setEditTplId(null)
      showToast('Template updated successfully!')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update template', 'error')
    }
  }

  const handleDeleteTemplate = async (tplId, tplTitle) => {
    if (!window.confirm(`Are you sure you want to delete the template "${tplTitle}"?`)) {
      return
    }
    try {
      await api.delete(`/api/v1/templates/${tplId}`)
      setTemplates(prev => prev.filter(t => t.id !== tplId))
      showToast('Template deleted successfully!')
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to delete template', 'error')
    }
  }

  const startEditCategory = (cat) => {
    setEditCatId(cat.id)
    setEditCatName(cat.name)
    setEditCatDesc(cat.description || '')
  }

  const startEditTemplate = (tpl) => {
    setEditTplId(tpl.id)
    setEditTplTitle(tpl.title)
    setEditTplDesc(tpl.description || '')
  }

  const filteredTemplates = templates.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <Layout title="Categories & Templates">
      <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="page-header-left">
          <h2 className="page-header-title">Categories & Templates</h2>
          <p className="page-header-sub">Manage global project categories and task creation templates.</p>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">
          <div className="spinner spinner-dark" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
          
          {/* LEFT COLUMN: Categories list */}
          <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Folder size={18} style={{ color: 'var(--brand-500)' }} />
                Categories
              </h3>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '4px 8px', fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                onClick={() => setShowAddCat(!showAddCat)}
              >
                {showAddCat ? <X size={14} /> : <Plus size={14} />}
                Add
              </button>
            </div>

            {/* Add Category Form */}
            {showAddCat && (
              <form onSubmit={handleAddCategory} className="card" style={{ background: 'var(--gray-50)', padding: 'var(--space-3)', border: '1px solid var(--gray-200)' }}>
                <h4 style={{ fontSize: 'var(--text-xs)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>New Category</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                    placeholder="Category name..."
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: '6px 8px', fontSize: 'var(--text-sm)' }}
                    placeholder="Description (optional)..."
                    value={newCatDesc}
                    onChange={e => setNewCatDesc(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '6px', fontSize: 'var(--text-xs)', width: '100%' }}>
                    Save Category
                  </button>
                </div>
              </form>
            )}

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '550px', overflowY: 'auto' }}>
              {categories.map(cat => {
                const isSelected = selectedCategory?.id === cat.id
                const isEditing = editCatId === cat.id

                if (isEditing) {
                  return (
                    <form key={cat.id} onSubmit={handleUpdateCategory} className="card" style={{ padding: '8px', background: 'var(--brand-50)', border: '1px solid var(--brand-200)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '4px 8px', fontSize: '13px' }} 
                        value={editCatName} 
                        onChange={e => setEditCatName(e.target.value)} 
                        required 
                      />
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ padding: '4px 8px', fontSize: '12px' }} 
                        value={editCatDesc} 
                        placeholder="Description (optional)"
                        onChange={e => setEditCatDesc(e.target.value)} 
                      />
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setEditCatId(null)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <Save size={12} /> Save
                        </button>
                      </div>
                    </form>
                  )
                }

                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--brand-100)' : 'transparent',
                      color: isSelected ? 'var(--brand-800)' : 'var(--gray-700)',
                      transition: 'background 150ms ease, color 150ms ease'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--gray-50)'
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                      <div style={{ fontWeight: isSelected ? 600 : 500, fontSize: 'var(--text-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat.name}
                      </div>
                      {cat.description && (
                        <div style={{ fontSize: '11px', color: isSelected ? 'var(--brand-600)' : 'var(--gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                          {cat.description}
                        </div>
                      )}
                    </div>
                    
                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: isSelected ? 'var(--brand-700)' : 'var(--gray-400)' }}
                        onClick={(e) => { e.stopPropagation(); startEditCategory(cat) }}
                      >
                        <Edit3 size={13} />
                      </button>
                      {cat.name !== 'General' && (
                        <button 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--danger)' }}
                          onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id, cat.name) }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: Task Templates */}
          <div className="card" style={{ minHeight: '500px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--gray-100)', paddingBottom: 'var(--space-4)' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--gray-800)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={20} style={{ color: 'var(--brand-500)' }} />
                  {selectedCategory ? `Templates: ${selectedCategory.name}` : 'Select a Category'}
                </h3>
                {selectedCategory?.description && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', marginTop: '4px' }}>
                    {selectedCategory.description}
                  </p>
                )}
              </div>
              {selectedCategory && (
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowAddTpl(!showAddTpl)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {showAddTpl ? <X size={16} /> : <Plus size={16} />}
                  Add Template Task
                </button>
              )}
            </div>

            {selectedCategory ? (
              <>
                {/* Add Template Inline Form */}
                {showAddTpl && (
                  <form onSubmit={handleAddTemplate} className="card" style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Create New Template Task</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                      <div className="form-group">
                        <label className="form-label">Task Title</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Conduct Discovery Call"
                          value={newTplTitle}
                          onChange={e => setNewTplTitle(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Default Description (optional)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Short summary of task objectives..."
                          value={newTplDesc}
                          onChange={e => setNewTplDesc(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowAddTpl(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary">Create Template</button>
                    </div>
                  </form>
                )}

                {/* Search / Filters */}
                <div className="search-bar" style={{ display: 'flex', maxWidth: '350px' }}>
                  <div className="search-input-wrapper" style={{ width: '100%', display: 'flex', alignItems: 'center', background: 'var(--surface-input)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: '0.5rem 0.75rem' }}>
                    <Search size={16} style={{ color: 'var(--gray-400)', marginRight: '8px' }} />
                    <input
                      type="text"
                      placeholder="Search templates in this category..."
                      style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 'var(--text-sm)' }}
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {/* Templates List */}
                {filteredTemplates.length === 0 ? (
                  <div className="empty-state" style={{ padding: 'var(--space-8) 0' }}>
                    <FileText size={48} style={{ color: 'var(--gray-300)', marginBottom: 'var(--space-2)' }} />
                    <p className="empty-state-title">No task templates found</p>
                    <p className="empty-state-desc">
                      {searchTerm ? 'Try adjusting your search filters.' : 'Add your first template task to speed up task creation for this category.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredTemplates.map(tpl => {
                      const isEditing = editTplId === tpl.id

                      if (isEditing) {
                        return (
                          <form 
                            key={tpl.id} 
                            onSubmit={handleUpdateTemplate} 
                            className="card" 
                            style={{ 
                              padding: 'var(--space-3)', 
                              background: 'var(--brand-50)', 
                              border: '1px solid var(--brand-200)',
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: 'var(--space-2)' 
                            }}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ padding: '6px 8px', fontSize: '13px' }} 
                                value={editTplTitle} 
                                onChange={e => setEditTplTitle(e.target.value)} 
                                placeholder="Template Title"
                                required 
                              />
                              <input 
                                type="text" 
                                className="form-input" 
                                style={{ padding: '6px 8px', fontSize: '13px' }} 
                                value={editTplDesc} 
                                placeholder="Default Description (optional)"
                                onChange={e => setEditTplDesc(e.target.value)} 
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                              <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setEditTplId(null)}>Cancel</button>
                              <button type="submit" className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <Save size={12} /> Save
                              </button>
                            </div>
                          </form>
                        )
                      }

                      return (
                        <div 
                          key={tpl.id} 
                          className="card" 
                          style={{ 
                            padding: '12px 16px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            border: '1px solid var(--gray-100)',
                            transition: 'box-shadow var(--transition)',
                          }}
                          onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
                          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                          <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--gray-800)' }}>
                              {tpl.title}
                            </div>
                            {tpl.description && (
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', marginTop: '2px' }}>
                                {tpl.description}
                              </div>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => startEditTemplate(tpl)}
                            >
                              <Edit3 size={13} />
                              Edit
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px 8px', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => handleDeleteTemplate(tpl.id, tpl.title)}
                            >
                              <Trash2 size={13} />
                              Delete
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state" style={{ padding: 'var(--space-12) 0' }}>
                <Folder size={48} style={{ color: 'var(--gray-300)', marginBottom: 'var(--space-2)' }} />
                <p className="empty-state-title">Select a Category</p>
                <p className="empty-state-desc">Choose a project category from the left pane to view and manage its task templates.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Alert */}
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
