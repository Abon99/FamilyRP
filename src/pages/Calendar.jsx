import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const MEMBERS = ['Alex', 'Jordan', 'Sam', 'Riley']
const MEMBER_COLORS = ['#378ADD', '#1D9E75', '#D85A30', '#D4537E']
const MEMBER_BG = ['#E6F1FB', '#E1F5EE', '#FAECE7', '#FBEAF0']
const MEMBER_TEXT = ['#0C447C', '#085041', '#4A1B0C', '#4B1528']

function mi(n) { return MEMBERS.indexOf(n) }
function initials(n) { return n.slice(0, 2).toUpperCase() }
function fmtDate(d) { return d.toISOString().split('T')[0] }

export default function Calendar({ user, session }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewDate, setViewDate] = useState(new Date())
  const [expandedDay, setExpandedDay] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterMember, setFilterMember] = useState('all')
  const [members, setMembers] = useState([])
  const [form, setForm] = useState({
    title: '', entry_type: 'event', entry_date: fmtDate(new Date()),
    entry_time: '09:00', notes: '', members: []
  })

  const today = new Date()

  useEffect(() => { loadEntries() }, [session])

  async function loadEntries() {
    setLoading(true)
    const { data, error } = await supabase
      .from('calendar_entries')
      .select(`*, calendar_entry_members(user_id)`)
      .order('entry_date', { ascending: true })
    if (error) {
      console.error('Error loading entries:', error)
    } else {
      setEntries(data || [])
    }
    setLoading(false)
  }

  async function saveEntry() {
  if (!form.title.trim()) { alert('Please enter a title'); return }
  setSaving(true)
  

  
  const { data, error } = await supabase
    .from('calendar_entries')
    .insert({
      title: form.title,
      entry_type: form.entry_type,
      entry_date: form.entry_date || null,
      entry_time: form.entry_time || null,
      notes: form.notes,
      done: false,
      created_by: user.id,
      session_id: session.id
    })
    .select()
    .single()
    

  
  if (error) {
    alert('Error saving: ' + error.message)
  } else {
  
    setShowModal(false)
    await loadEntries()
  }
  setSaving(false)
}

  async function markDone(id) {
    await supabase.from('calendar_entries').update({ done: true }).eq('id', id)
    await loadEntries()
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return
    await supabase.from('calendar_entries').delete().eq('id', id)
    await loadEntries()
  }

  function entriesForDate(ds) {
    return entries.filter(e => e.entry_date === ds)
  }

  function pillStyle(e) {
    if (e.done) return { background: '#EAF3DE', color: '#27500A' }
    if (e.entry_type === 'event') return { background: '#E6F1FB', color: '#0C447C' }
    return { background: '#FAEEDA', color: '#633806' }
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDow = (first.getDay() + 6) % 7
  const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  let cells = []
  for (let i = 0; i < startDow; i++) cells.push({ date: new Date(year, month, 1 - startDow + i), other: true })
  for (let d = 1; d <= last.getDate(); d++) cells.push({ date: new Date(year, month, d), other: false })
  while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month + 1, cells.length - last.getDate() - startDow + 1), other: true })

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: '#888780' }}>
      Loading calendar...
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={btnStyle}>←</button>
          <span style={{ fontSize: 15, fontWeight: 500, minWidth: 160, textAlign: 'center' }}>{monthNames[month]} {year}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} style={btnStyle}>→</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={filterMember} onChange={e => setFilterMember(e.target.value)} style={selectStyle}>
            <option value="all">All members</option>
            {MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={() => setShowModal(true)} style={primaryBtnStyle}>+ Add entry</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {[['#E6F1FB', '#0C447C', 'Event'], ['#FAEEDA', '#633806', 'Task'], ['#EAF3DE', '#27500A', 'Done']].map(([bg, tc, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888780' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: bg, border: `1px solid ${tc}` }}></div>
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e4', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {dows.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#888780', padding: '6px 0', borderBottom: '1px solid #e8e8e4', fontWeight: 500 }}>{d}</div>
          ))}
          {cells.map((cell, idx) => {
            const ds = fmtDate(cell.date)
            const isToday = ds === fmtDate(today)
            const isExpanded = expandedDay === ds
            const dayEntries = entriesForDate(ds)
            return (
              <div key={idx}
                onClick={() => setExpandedDay(expandedDay === ds ? null : ds)}
                style={{
                  minHeight: 80, borderRight: idx % 7 !== 6 ? '1px solid #e8e8e4' : 'none',
                  borderBottom: '1px solid #e8e8e4', padding: 4, cursor: 'pointer',
                  background: isExpanded ? '#f0f8ff' : cell.other ? '#fafafa' : '#fff'
                }}>
                <div style={{
                  fontSize: 12, fontWeight: 500, marginBottom: 3, width: 22, height: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
                  background: isToday ? '#378ADD' : 'none', color: isToday ? '#fff' : cell.other ? '#ccc' : '#2c2c2a'
                }}>{cell.date.getDate()}</div>
                {dayEntries.slice(0, isExpanded ? 10 : 2).map(e => (
                  <div key={e.id} style={{ fontSize: 10, padding: '2px 5px', borderRadius: 3, marginBottom: 2, ...pillStyle(e), overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {e.entry_time ? e.entry_time.slice(0, 5) + ' ' : ''}{e.title}
                  </div>
                ))}
                {!isExpanded && dayEntries.length > 2 && (
                  <div style={{ fontSize: 10, color: '#888780' }}>+{dayEntries.length - 2} more</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Expanded day detail */}
      {expandedDay && (
        <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: 12, padding: '1rem', marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: '#2c2c2a' }}>{expandedDay}</div>
          {entriesForDate(expandedDay).length === 0 ? (
            <div style={{ fontSize: 12, color: '#b0b0ac' }}>No entries — click "+ Add entry" to add one.</div>
          ) : (
            entriesForDate(expandedDay).map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f0f0ee' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: e.done ? '#639922' : e.entry_type === 'event' ? '#378ADD' : '#EF9F27', flexShrink: 0 }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, textDecoration: e.done ? 'line-through' : 'none', color: e.done ? '#888780' : '#2c2c2a' }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: '#888780' }}>{e.entry_type} {e.entry_time ? '· ' + e.entry_time.slice(0, 5) : ''} {e.notes ? '· ' + e.notes : ''}</div>
                </div>
                {!e.done && <button onClick={() => markDone(e.id)} style={{ fontSize: 11, color: '#27500A', background: '#EAF3DE', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>✓ Done</button>}
                <button onClick={() => deleteEntry(e.id)} style={{ fontSize: 11, color: '#A32D2D', background: '#FCEBEB', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>Delete</button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add entry modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e4', padding: '1.5rem', width: '100%', maxWidth: 440 }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16, color: '#2c2c2a' }}>New calendar entry</h3>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {['event', 'task'].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, entry_type: t }))}
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #d0d0cc', cursor: 'pointer', background: form.entry_type === t ? '#E6F1FB' : 'none', color: form.entry_type === t ? '#0C447C' : '#888780', fontWeight: form.entry_type === t ? 500 : 400 }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            {[
              { label: 'Title', key: 'title', type: 'text', placeholder: 'Entry title' },
              { label: 'Date', key: 'entry_date', type: 'date' },
              { label: 'Time', key: 'entry_time', type: 'time' },
              { label: 'Notes (optional)', key: 'notes', type: 'text', placeholder: 'Any notes' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type} value={form[f.key]} placeholder={f.placeholder || ''}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 13, boxSizing: 'border-box', color: '#2c2c2a' }} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #d0d0cc', background: 'none', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={saveEntry} disabled={saving}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                {saving ? 'Saving...' : 'Save entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const btnStyle = { background: 'none', border: '1px solid #d0d0cc', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 13 }
const selectStyle = { padding: '6px 10px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 12, cursor: 'pointer', background: '#fff', color: '#2c2c2a' }
const primaryBtnStyle = { padding: '6px 14px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }
