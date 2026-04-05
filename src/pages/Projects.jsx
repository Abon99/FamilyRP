import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Projects({ user, session }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(new Set())
  const [form, setForm] = useState({ name: '', description: '', start_date: '', end_date: '', colour: '#378ADD' })

  useEffect(() => { loadProjects() }, [session])

  async function loadProjects() {
    setLoading(true)
    const { data } = await supabase.from('projects')
      .select('*, project_tasks(*)')
      .eq('session_id', session.id)
      .order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }

  async function saveProject() {
    if (!form.name.trim() || !form.start_date || !form.end_date) { alert('Please fill in name and dates'); return }
    setSaving(true)
    const { error } = await supabase.from('projects').insert({
      session_id: session.id, name: form.name, description: form.description,
      start_date: form.start_date, end_date: form.end_date, colour: form.colour,
      status: 'active', created_by: user.id
    })
    if (error) alert('Error: ' + error.message)
    else { setShowModal(false); setForm({ name: '', description: '', start_date: '', end_date: '', colour: '#378ADD' }); await loadProjects() }
    setSaving(false)
  }

  async function markTaskDone(taskId) {
    await supabase.from('project_tasks').update({ done: true, done_at: new Date().toISOString() }).eq('id', taskId)
    await loadProjects()
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888780', textAlign: 'center' }}>Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Projects</span>
          <span style={{ fontSize: 12, color: '#888780', marginLeft: 8 }}>{projects.length} total</span>
        </div>
        <button onClick={() => setShowModal(true)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ New project</button>
      </div>

      {projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#888780', fontSize: 13 }}>No projects yet. Create your first one!</div>
      ) : (
        projects.map(p => {
          const tasks = p.project_tasks || []
          const done = tasks.filter(t => t.done).length
          const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0
          const isExpanded = expanded.has(p.id)
          return (
            <div key={p.id} style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 4, height: 40, borderRadius: 2, background: p.colour, flexShrink: 0, marginTop: 2 }}></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#2c2c2a', marginBottom: 2 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#888780' }}>{p.start_date} → {p.end_date} · {done}/{tasks.length} tasks</div>
                    <div style={{ height: 4, background: '#f0f0ee', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: p.colour, width: pct + '%', borderRadius: 2 }}></div>
                    </div>
                  </div>
                  <button onClick={() => setExpanded(e => { const n = new Set(e); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}
                    style={{ fontSize: 12, color: '#378ADD', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {isExpanded ? 'Hide' : 'Tasks'}
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div style={{ borderTop: '1px solid #f0f0ee', padding: '10px 16px' }}>
                  {tasks.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#b0b0ac' }}>No tasks yet.</div>
                  ) : (
                    tasks.map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f8f8f6', fontSize: 13 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.done ? '#639922' : !t.assigned_to ? '#EF9F27' : '#D85A30', flexShrink: 0 }}></div>
                        <span style={{ flex: 1, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? '#888780' : '#2c2c2a' }}>{t.title}</span>
                        {t.deadline && <span style={{ fontSize: 10, color: '#888780' }}>Due {t.deadline}</span>}
                        {!t.done && <button onClick={() => markTaskDone(t.id)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: 'none', background: '#EAF3DE', color: '#27500A', cursor: 'pointer' }}>✓</button>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', width: '100%', maxWidth: 420, border: '1px solid #e8e8e4' }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16, color: '#2c2c2a' }}>New project</h3>
            {[
              { label: 'Project name', key: 'name', type: 'text', placeholder: 'e.g. Kitchen Renovation' },
              { label: 'Description (optional)', key: 'description', type: 'text', placeholder: 'What is this project about?' },
              { label: 'Start date', key: 'start_date', type: 'date' },
              { label: 'End date', key: 'end_date', type: 'date' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type} value={form[f.key]} placeholder={f.placeholder}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 13, boxSizing: 'border-box', color: '#2c2c2a' }} />
              </div>
            ))}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 4 }}>Colour</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['#378ADD','#1D9E75','#D85A30','#D4537E','#7F77DD','#BA7517'].map(c => (
                  <div key={c} onClick={() => setForm(p => ({ ...p, colour: c }))}
                    style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: form.colour === c ? '3px solid #2c2c2a' : '2px solid transparent' }}></div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #d0d0cc', background: 'none', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={saveProject} disabled={saving} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                {saving ? 'Saving...' : 'Create project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
