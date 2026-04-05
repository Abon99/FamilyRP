import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function fmtDate(d) { return d.toISOString().split('T')[0] }

export default function Calendar({ user, session }) {
  const [entries, setEntries] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewDate, setViewDate] = useState(new Date())
  const [view, setView] = useState('month') // month | day
  const [expandedDay, setExpandedDay] = useState(null)
  const [dayPopup, setDayPopup] = useState(null) // date string of popup open
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState(null) // entry being edited, null = new
  const [saving, setSaving] = useState(false)
  const [filterMember, setFilterMember] = useState('all')
  const [form, setForm] = useState({
    title: '', entry_type: 'event', entry_date: fmtDate(new Date()),
    entry_time: '', notes: ''
  })

  const today = new Date()

  useEffect(() => { loadEntries() }, [session])

  async function loadEntries() {
    setLoading(true)
    const [{ data: e }, { data: m }] = await Promise.all([
      supabase.from('calendar_entries').select('*')
        .eq('session_id', session.id)
        .order('entry_date', { ascending: true }),
      supabase.from('session_members')
        .select('user_id, users!inner(id, display_name, email)')
        .eq('session_id', session.id)
    ])
    setEntries(e || [])
    setMembers(m || [])
    setLoading(false)
  }

  function openNewEntry(date, type) {
    setEditEntry(null)
    setForm({ title: '', entry_type: type || 'event', entry_date: date || fmtDate(today), entry_time: '', notes: '' })
    setDayPopup(null)
    setShowModal(true)
  }

  function openEditEntry(entry) {
    setEditEntry(entry)
    setForm({
      title: entry.title,
      entry_type: entry.entry_type,
      entry_date: entry.entry_date || '',
      entry_time: entry.entry_time ? entry.entry_time.slice(0, 5) : '',
      notes: entry.notes || ''
    })
    setShowModal(true)
  }

  async function saveEntry() {
    if (!form.title.trim()) { alert('Please enter a title'); return }
    setSaving(true)
    if (editEntry) {
      // Update existing
      const { error } = await supabase
        .from('calendar_entries')
        .update({
          title: form.title,
          entry_type: form.entry_type,
          entry_date: form.entry_date || null,
          entry_time: form.entry_time || null,
          notes: form.notes,
        })
        .eq('id', editEntry.id)
      if (error) alert('Error saving: ' + error.message)
    } else {
      // Insert new
      const { error } = await supabase
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
      if (error) alert('Error saving: ' + error.message)
    }
    setShowModal(false)
    setEditEntry(null)
    await loadEntries()
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
    return entries.filter(e => {
      const match = e.entry_date === ds
      if (filterMember === 'all') return match
      return match
    })
  }

  function pillStyle(e) {
    if (e.done) return { background: '#EAF3DE', color: '#27500A' }
    if (e.entry_type === 'event') return { background: '#E6F1FB', color: '#0C447C' }
    return { background: '#FAEEDA', color: '#633806' }
  }

  function dotColor(e) {
    if (e.done) return '#639922'
    if (e.entry_type === 'event') return '#378ADD'
    return '#EF9F27'
  }

  // ── Month view ────────────────────────────────────────────
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDow = (first.getDay() + 6) % 7
  const dows = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  let cells = []
  for (let i = 0; i < startDow; i++) cells.push({ date: new Date(year, month, 1 - startDow + i), other: true })
  for (let d = 1; d <= last.getDate(); d++) cells.push({ date: new Date(year, month, d), other: false })
  while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month + 1, cells.length - last.getDate() - startDow + 1), other: true })

  if (loading) return <div style={{ padding: '2rem', color: '#888780', textAlign: 'center' }}>Loading calendar...</div>

  // ── Day view ──────────────────────────────────────────────
  if (view === 'day') {
    const ds = fmtDate(viewDate)
    const dayEntries = entriesForDate(ds)
    const slots = []
    for (let h = 7; h < 23; h++) { slots.push(`${h}:00`); slots.push(`${h}:30`) }

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setView('month')} style={btnStyle}>← Month</button>
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() - 1))} style={btnStyle}>←</button>
          <span style={{ fontSize: 14, fontWeight: 500, minWidth: 130, textAlign: 'center' }}>{ds}</span>
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() + 1))} style={btnStyle}>→</button>
          <button onClick={() => openNewEntry(ds, 'event')} style={primaryBtnStyle}>+ Add entry</button>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e4', overflow: 'hidden' }}>
          {slots.map(slot => {
            const slotEntries = dayEntries.filter(e => e.entry_time && e.entry_time.slice(0, 5) === slot)
            return (
              <div key={slot} style={{ display: 'flex', borderBottom: '1px solid #f0f0ee', minHeight: 32 }}>
                <div style={{ width: 52, fontSize: 10, color: '#b0b0ac', padding: '6px 6px 0', flexShrink: 0, textAlign: 'right' }}>{slot}</div>
                <div style={{ flex: 1, padding: '3px 6px', cursor: 'pointer' }}
                  onClick={() => openNewEntry(ds, 'event')}>
                  {slotEntries.map(e => (
                    <div key={e.id}
                      onClick={ev => { ev.stopPropagation(); openEditEntry(e) }}
                      style={{ fontSize: 12, padding: '3px 8px', borderRadius: 5, marginBottom: 2, cursor: 'pointer', ...pillStyle(e), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ textDecoration: e.done ? 'line-through' : 'none' }}>{e.title}</span>
                      <span style={{ fontSize: 10, opacity: .7 }}>tap to edit</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Day entries detail */}
        {dayEntries.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: 12, padding: '1rem', marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: '#2c2c2a' }}>All entries for {ds}</div>
            {dayEntries.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f0f0ee' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor(e), flexShrink: 0 }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, textDecoration: e.done ? 'line-through' : 'none', color: e.done ? '#888780' : '#2c2c2a' }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: '#888780' }}>{e.entry_type}{e.entry_time ? ' · ' + e.entry_time.slice(0, 5) : ''}{e.notes ? ' · ' + e.notes : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  <button onClick={() => openEditEntry(e)}
                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: 'none', background: '#E6F1FB', color: '#0C447C', cursor: 'pointer' }}>
                    ✏️ Edit
                  </button>
                  {!e.done && (
                    <button onClick={() => markDone(e.id)}
                      style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: 'none', background: '#EAF3DE', color: '#27500A', cursor: 'pointer' }}>
                      ✓ Done
                    </button>
                  )}
                  <button onClick={() => deleteEntry(e.id)}
                    style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: 'none', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {modal()}
      </div>
    )
  }

  // ── Month view render ─────────────────────────────────────
  return (
    <div onClick={() => setDayPopup(null)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={btnStyle}>←</button>
          <span style={{ fontSize: 14, fontWeight: 500, minWidth: 150, textAlign: 'center' }}>{monthNames[month]} {year}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} style={btnStyle}>→</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={filterMember} onChange={e => setFilterMember(e.target.value)} style={selectStyle}>
            <option value="all">All members</option>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.users?.display_name || m.users?.email}</option>)}
          </select>
          <button onClick={() => openNewEntry(fmtDate(today))} style={primaryBtnStyle}>+ Add entry</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {[['#E6F1FB','#0C447C','Event'],['#FAEEDA','#633806','Task'],['#EAF3DE','#27500A','Done']].map(([bg,tc,label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888780' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: bg, border: `1px solid ${tc}` }}></div>{label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e4', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {dows.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#888780', padding: '6px 0', borderBottom: '1px solid #e8e8e4', fontWeight: 500 }}>{d}</div>
          ))}
          {cells.map((cell, idx) => {
            const ds = fmtDate(cell.date)
            const isToday = ds === fmtDate(today)
            const dayEntries = entriesForDate(ds)
            const isPopupOpen = dayPopup === ds
            const col = idx % 7

            return (
              <div key={idx} style={{ position: 'relative', minHeight: 80, borderRight: idx % 7 !== 6 ? '1px solid #e8e8e4' : 'none', borderBottom: '1px solid #e8e8e4', padding: 4, background: cell.other ? '#fafafa' : '#fff' }}
                onClick={e => { e.stopPropagation(); setDayPopup(isPopupOpen ? null : ds) }}>

                {/* Day number */}
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? '#378ADD' : 'none', color: isToday ? '#fff' : cell.other ? '#ccc' : '#2c2c2a' }}>
                  {cell.date.getDate()}
                </div>

                {/* Entry pills */}
                {dayEntries.slice(0, 2).map(e => (
                  <div key={e.id} style={{ fontSize: 10, padding: '2px 5px', borderRadius: 3, marginBottom: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', ...pillStyle(e) }}>
                    {e.entry_time ? e.entry_time.slice(0, 5) + ' ' : ''}{e.title}
                  </div>
                ))}
                {dayEntries.length > 2 && <div style={{ fontSize: 10, color: '#888780' }}>+{dayEntries.length - 2} more</div>}

                {/* Day popup — two options */}
                {isPopupOpen && (
                  <div style={{ position: 'absolute', top: 26, ...(col >= 5 ? { right: 0 } : { left: 0 }), zIndex: 30, background: '#fff', border: '1px solid #d0d0cc', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 170, overflow: 'hidden' }}
                    onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: 11, color: '#888780', padding: '6px 10px 4px', borderBottom: '1px solid #f0f0ee', fontWeight: 500 }}>{ds}</div>
                    <div style={popupOptionStyle} onClick={() => { setDayPopup(null); setView('day'); setViewDate(new Date(ds)) }}>
                      <span style={popupIconStyle('📅')}>📅</span> View day schedule
                    </div>
                    <div style={popupOptionStyle} onClick={() => { openNewEntry(ds, 'event') }}>
                      <span style={popupIconStyle('➕')}>➕</span> Add event
                    </div>
                    <div style={popupOptionStyle} onClick={() => { openNewEntry(ds, 'task') }}>
                      <span style={popupIconStyle('✅')}>✅</span> Add task
                    </div>
                    {dayEntries.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, color: '#b0b0ac', padding: '4px 10px 2px', borderTop: '1px solid #f0f0ee' }}>Entries</div>
                        {dayEntries.map(e => (
                          <div key={e.id} style={{ ...popupOptionStyle, fontSize: 11 }}
                            onClick={() => { setDayPopup(null); openEditEntry(e) }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor(e), flexShrink: 0 }}></div>
                            <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>{e.title}</span>
                            <span style={{ fontSize: 10, color: '#b0b0ac', flexShrink: 0 }}>edit</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      {modal()}
    </div>
  )

  // ── Modal ─────────────────────────────────────────────────
  function modal() {
    if (!showModal) return null
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
        onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e4', padding: '1.5rem', width: '100%', maxWidth: 440 }}>
          <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 14, color: '#2c2c2a' }}>
            {editEntry ? 'Edit entry' : 'New calendar entry'}
          </h3>

          {/* Type toggle — only for new entries */}
          {!editEntry && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {['event','task'].map(t => (
                <button key={t} onClick={() => setForm(f => ({ ...f, entry_type: t }))}
                  style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #d0d0cc', cursor: 'pointer', background: form.entry_type === t ? '#E6F1FB' : 'none', color: form.entry_type === t ? '#0C447C' : '#888780', fontWeight: form.entry_type === t ? 500 : 400, fontSize: 13 }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          )}

          {[
            { label: 'Title', key: 'title', type: 'text', placeholder: 'Entry title' },
            { label: 'Date', key: 'entry_date', type: 'date' },
            { label: 'Time (optional)', key: 'entry_time', type: 'time' },
            { label: 'Notes (optional)', key: 'notes', type: 'text', placeholder: 'Any notes' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input type={f.type} value={form[f.key]} placeholder={f.placeholder || ''}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 13, boxSizing: 'border-box', color: '#2c2c2a' }} />
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            {editEntry && (
              <button onClick={() => { deleteEntry(editEntry.id); setShowModal(false) }}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer', fontSize: 13, marginRight: 'auto' }}>
                Delete
              </button>
            )}
            <button onClick={() => { setShowModal(false); setEditEntry(null) }}
              style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #d0d0cc', background: 'none', cursor: 'pointer', fontSize: 13 }}>
              Cancel
            </button>
            <button onClick={saveEntry} disabled={saving}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
              {saving ? 'Saving...' : editEntry ? 'Save changes' : 'Add entry'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}

const btnStyle = { background: 'none', border: '1px solid #d0d0cc', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 13 }
const selectStyle = { padding: '6px 10px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 12, cursor: 'pointer', background: '#fff', color: '#2c2c2a' }
const primaryBtnStyle = { padding: '6px 14px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }
const popupOptionStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, color: '#2c2c2a', borderBottom: '0.5px solid #f8f8f6' }
function popupIconStyle() { return { fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 } }
