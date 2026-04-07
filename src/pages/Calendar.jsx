import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

function fmtDate(d) { return d.toISOString().split('T')[0] }

function buildInitials(names) {
  if (!names || names.length === 0) return []
  if (names.length === 1) return [names[0][0]?.toUpperCase() || '?']
  return names.map((name, i) => {
    const others = names.filter((_, j) => j !== i)
    let len = 1
    while (len <= name.length) {
      const candidate = name.slice(0, len).toUpperCase()
      const clash = others.some(o => o.slice(0, len).toUpperCase() === candidate)
      if (!clash) return candidate
      len++
    }
    return name.slice(0, 2).toUpperCase()
  })
}

const AVATAR_BG = ['#E6F1FB','#E1F5EE','#FAECE7','#FBEAF0','#EEEDFE','#FEF3E2','#E8F5E9']
const AVATAR_TC = ['#0C447C','#085041','#4A1B0C','#4B1528','#26215C','#7A4500','#1B5E20']

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return isMobile
}

export default function Calendar({ user, session }) {
  const [entries, setEntries] = useState([])
  const [entryMembers, setEntryMembers] = useState({})
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewDate, setViewDate] = useState(new Date())
  const [view, setView] = useState('month')
  const [dayPopup, setDayPopup] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [saving, setSaving] = useState(false)
  const [filterMember, setFilterMember] = useState('all')
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    title: '', entry_type: 'event',
    entry_date: fmtDate(new Date()), end_date: '',
    entry_time: '', end_time: '',
    notes: '', participants: []
  })

  const today = new Date()
  const isMobile = useIsMobile()

  useEffect(() => { loadEntries() }, [session])

  async function loadEntries() {
    setLoading(true)
    const [{ data: e }, { data: m }, { data: em }] = await Promise.all([
      supabase.from('calendar_entries').select('*')
        .eq('session_id', session.id)
        .order('entry_date', { ascending: true }),
      supabase.from('session_members')
        .select('user_id, users!inner(id, display_name, email)')
        .eq('session_id', session.id),
      supabase.from('calendar_entry_members').select('entry_id, user_id')
    ])
    setEntries(e || [])
    setMembers(m || [])
    const grouped = {}
    ;(em || []).forEach(r => {
      if (!grouped[r.entry_id]) grouped[r.entry_id] = []
      grouped[r.entry_id].push(r.user_id)
    })
    setEntryMembers(grouped)
    setLoading(false)
  }

  const getMemberName = (id) => {
    const m = members.find(m => m.user_id === id)
    return m?.users?.display_name || m?.users?.email?.split('@')[0] || '?'
  }

  function getEntryInitials(entry) {
    const participantIds = entryMembers[entry.id] || []
    if (participantIds.length === 0) return [getMemberName(entry.created_by)[0]?.toUpperCase() || '?']
    const names = participantIds.map(id => getMemberName(id))
    return buildInitials(names)
  }

  function openNewEntry(date, type) {
    setEditEntry(null)
    setFormError('')
    setForm({
      title: '', entry_type: type || 'event',
      entry_date: date || fmtDate(today), end_date: '',
      entry_time: '', end_time: '',
      notes: '', participants: [user.id]
    })
    setDayPopup(null)
    setShowModal(true)
  }

  function openEditEntry(entry) {
    setEditEntry(entry)
    setFormError('')
    setForm({
      title: entry.title,
      entry_type: entry.entry_type,
      entry_date: entry.entry_date || '',
      end_date: entry.end_date || '',
      entry_time: entry.entry_time ? entry.entry_time.slice(0, 5) : '',
      end_time: entry.end_time ? entry.end_time.slice(0, 5) : '',
      notes: entry.notes || '',
      participants: entryMembers[entry.id] || []
    })
    setShowModal(true)
  }

  function toggleParticipant(uid) {
    setForm(p => ({
      ...p,
      participants: p.participants.includes(uid)
        ? p.participants.filter(id => id !== uid)
        : [...p.participants, uid]
    }))
  }

  // ── Validation ────────────────────────────────────────────
  function validateForm() {
    if (!form.title.trim()) return 'Please enter a title'

    // End date must not be before start date
    if (form.end_date && form.entry_date) {
      if (form.end_date < form.entry_date) {
        return 'End date cannot be before the start date'
      }
    }

    // End time must not be before start time on the same day
    if (form.end_time && form.entry_time) {
      const sameDay = !form.end_date || form.end_date === form.entry_date
      if (sameDay && form.end_time <= form.entry_time) {
        return 'End time must be after the start time'
      }
    }

    return null
  }

  async function saveEntry() {
    const error = validateForm()
    if (error) { setFormError(error); return }
    setFormError('')
    setSaving(true)
    const payload = {
      title: form.title, entry_type: form.entry_type,
      entry_date: form.entry_date || null, end_date: form.end_date || null,
      entry_time: form.entry_time || null, end_time: form.end_time || null,
      notes: form.notes,
    }
    let entryId = editEntry?.id
    if (editEntry) {
      const { error } = await supabase.from('calendar_entries').update(payload).eq('id', editEntry.id)
      if (error) { setFormError('Error: ' + error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('calendar_entries')
        .insert({ ...payload, done: false, created_by: user.id, session_id: session.id })
        .select().single()
      if (error) { setFormError('Error: ' + error.message); setSaving(false); return }
      entryId = data.id
    }
    await supabase.from('calendar_entry_members').delete().eq('entry_id', entryId)
    if (form.participants.length > 0) {
      await supabase.from('calendar_entry_members').insert(
        form.participants.map(uid => ({ entry_id: entryId, user_id: uid }))
      )
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
    await supabase.from('calendar_entry_members').delete().eq('entry_id', id)
    await supabase.from('calendar_entries').delete().eq('id', id)
    setShowModal(false)
    await loadEntries()
  }

  function entrySpansDate(entry, ds) {
    const start = entry.entry_date
    const end = entry.end_date || entry.entry_date
    if (!start) return false
    return ds >= start && ds <= end
  }

  function entriesForDate(ds) {
    return entries.filter(e => {
      if (!entrySpansDate(e, ds)) return false
      if (filterMember === 'all') return true
      const participants = entryMembers[e.id] || []
      return participants.includes(filterMember) || e.created_by === filterMember
    })
  }

  function isMultiDay(entry) {
    return entry.end_date && entry.end_date !== entry.entry_date
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

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDow = (first.getDay() + 6) % 7
  const dows = isMobile ? ['M','T','W','T','F','S','S'] : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  let cells = []
  for (let i = 0; i < startDow; i++) cells.push({ date: new Date(year, month, 1 - startDow + i), other: true })
  for (let d = 1; d <= last.getDate(); d++) cells.push({ date: new Date(year, month, d), other: false })
  while (cells.length % 7 !== 0) cells.push({ date: new Date(year, month + 1, cells.length - last.getDate() - startDow + 1), other: true })

  if (loading) return <div style={{ padding: '2rem', color: '#888780', textAlign: 'center' }}>Loading calendar...</div>

  // ── Day view ──────────────────────────────────────────────
  if (view === 'day') {
    const ds = fmtDate(viewDate)
    const dayEntries = entriesForDate(ds)
    const allDayEntries = dayEntries.filter(e => !e.entry_time || isMultiDay(e))
    const timedEntries = dayEntries.filter(e => e.entry_time && !isMultiDay(e))
    const slots = []
    for (let h = 6; h < 23; h++) { slots.push(`${String(h).padStart(2,'0')}:00`); slots.push(`${String(h).padStart(2,'0')}:30`) }

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setView('month')} style={btnStyle}>← Month</button>
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() - 1))} style={btnStyle}>←</button>
          <span style={{ fontSize: 14, fontWeight: 500, minWidth: isMobile ? 100 : 130, textAlign: 'center' }}>{ds}</span>
          <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth(), viewDate.getDate() + 1))} style={btnStyle}>→</button>
          <button onClick={() => openNewEntry(ds, 'event')} style={primaryBtnStyle}>+ Add</button>
        </div>

        {allDayEntries.length > 0 && (
          <div style={{ background: '#f8f8f6', border: '1px solid #e8e8e4', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#888780', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>All day</div>
            {allDayEntries.map(e => {
              const participantIds = entryMembers[e.id] || []
              return (
                <div key={e.id} onClick={() => openEditEntry(e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer', ...pillStyle(e) }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, textDecoration: e.done ? 'line-through' : 'none' }}>{e.title}</div>
                    {isMultiDay(e) && <div style={{ fontSize: 10, opacity: 0.7 }}>{e.entry_date} → {e.end_date}</div>}
                  </div>
                  <AvatarRow participantIds={participantIds} members={members} size={22} />
                </div>
              )
            })}
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e4', overflow: 'hidden' }}>
          {slots.map(slot => {
            const slotEntries = timedEntries.filter(e => e.entry_time && e.entry_time.slice(0, 5) === slot)
            return (
              <div key={slot} style={{ display: 'flex', borderBottom: '1px solid #f0f0ee', minHeight: 32 }}>
                <div style={{ width: isMobile ? 42 : 52, fontSize: 10, color: '#b0b0ac', padding: '6px 4px 0', flexShrink: 0, textAlign: 'right' }}>{slot}</div>
                <div style={{ flex: 1, padding: '3px 6px', cursor: 'pointer' }} onClick={() => openNewEntry(ds, 'event')}>
                  {slotEntries.map(e => {
                    const participantIds = entryMembers[e.id] || []
                    return (
                      <div key={e.id} onClick={ev => { ev.stopPropagation(); openEditEntry(e) }}
                        style={{ fontSize: 12, padding: '3px 8px', borderRadius: 5, marginBottom: 2, cursor: 'pointer', ...pillStyle(e), display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ textDecoration: e.done ? 'line-through' : 'none', flex: 1 }}>{e.title}</span>
                        {e.end_time && <span style={{ fontSize: 10, opacity: 0.6 }}>→ {e.end_time.slice(0,5)}</span>}
                        <AvatarRow participantIds={participantIds} members={members} size={18} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {dayEntries.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: 12, padding: '1rem', marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: '#2c2c2a' }}>All entries for {ds}</div>
            {dayEntries.map(e => {
              const participantIds = entryMembers[e.id] || []
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid #f0f0ee' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor(e), flexShrink: 0, marginTop: 4 }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, textDecoration: e.done ? 'line-through' : 'none', color: e.done ? '#888780' : '#2c2c2a' }}>{e.title}</div>
                    <div style={{ fontSize: 11, color: '#888780', marginTop: 1 }}>
                      {e.entry_type}
                      {e.entry_time ? ` · ${e.entry_time.slice(0,5)}` : ''}
                      {e.end_time ? ` → ${e.end_time.slice(0,5)}` : ''}
                      {isMultiDay(e) ? ` · until ${e.end_date}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: '#888780', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>By {getMemberName(e.created_by)}</span>
                      {participantIds.length > 0 && <>· <AvatarRow participantIds={participantIds} members={members} size={18} showNames /></>}
                    </div>
                    {e.notes && <div style={{ fontSize: 11, color: '#888780', marginTop: 1, fontStyle: 'italic' }}>{e.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <button onClick={() => openEditEntry(e)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: 'none', background: '#E6F1FB', color: '#0C447C', cursor: 'pointer' }}>✏️</button>
                    {!e.done && <button onClick={() => markDone(e.id)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: 'none', background: '#EAF3DE', color: '#27500A', cursor: 'pointer' }}>✓</button>}
                    <button onClick={() => deleteEntry(e.id)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: 'none', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer' }}>🗑</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {modal()}
      </div>
    )
  }

  // ── Month view ────────────────────────────────────────────
  return (
    <div onClick={() => setDayPopup(null)}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} style={btnStyle}>←</button>
          <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 500, minWidth: isMobile ? 110 : 150, textAlign: 'center' }}>{monthNames[month]} {year}</span>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} style={btnStyle}>→</button>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
            style={{ ...selectStyle, fontSize: isMobile ? 11 : 12, padding: isMobile ? '4px 6px' : '6px 10px' }}>
            <option value="all">{isMobile ? 'All' : 'All members'}</option>
            {members.map(m => (
              <option key={m.user_id} value={m.user_id}>
                {isMobile ? (m.users?.display_name || m.users?.email)?.split(' ')[0] : m.users?.display_name || m.users?.email}
              </option>
            ))}
          </select>
          <button onClick={() => openNewEntry(fmtDate(today))} style={{ ...primaryBtnStyle, fontSize: isMobile ? 11 : 13, padding: isMobile ? '5px 10px' : '6px 14px' }}>
            + Add
          </button>
        </div>
      </div>

      {!isMobile && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          {[['#E6F1FB','#0C447C','Event'],['#FAEEDA','#633806','Task'],['#EAF3DE','#27500A','Done']].map(([bg,tc,label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888780' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: bg, border: `1px solid ${tc}` }}></div>{label}
            </div>
          ))}
        </div>
      )}

      {isMobile && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          {[['#378ADD','Event'],['#EF9F27','Task'],['#639922','Done']].map(([c,label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#888780' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }}></div>{label}
            </div>
          ))}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e4', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {dows.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: isMobile ? 10 : 11, color: '#888780', padding: isMobile ? '5px 0' : '6px 0', borderBottom: '1px solid #e8e8e4', fontWeight: 500 }}>{d}</div>
          ))}

          {cells.map((cell, idx) => {
            const ds = fmtDate(cell.date)
            const isToday = ds === fmtDate(today)
            const dayEntries = entriesForDate(ds)
            const col = idx % 7

            if (isMobile) {
              return (
                <div key={idx}
                  onClick={() => { setView('day'); setViewDate(new Date(ds + 'T12:00:00')) }}
                  style={{ borderRight: col !== 6 ? '1px solid #e8e8e4' : 'none', borderBottom: '1px solid #e8e8e4', padding: '6px 2px', background: cell.other ? '#fafafa' : '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minHeight: 52, cursor: 'pointer' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? '#378ADD' : 'none', color: isToday ? '#fff' : cell.other ? '#ccc' : '#2c2c2a' }}>
                    {cell.date.getDate()}
                  </div>
                  {dayEntries.length > 0 && (
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {dayEntries.slice(0, 3).map((e, i) => (
                        <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor(e), flexShrink: 0 }} />
                      ))}
                      {dayEntries.length > 3 && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#ccc', flexShrink: 0 }} />}
                    </div>
                  )}
                </div>
              )
            }

            const isPopupOpen = dayPopup === ds
            return (
              <div key={idx}
                style={{ position: 'relative', minHeight: 80, borderRight: col !== 6 ? '1px solid #e8e8e4' : 'none', borderBottom: '1px solid #e8e8e4', padding: 4, background: cell.other ? '#fafafa' : '#fff' }}
                onClick={e => { e.stopPropagation(); setDayPopup(isPopupOpen ? null : ds) }}>

                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday ? '#378ADD' : 'none', color: isToday ? '#fff' : cell.other ? '#ccc' : '#2c2c2a' }}>
                  {cell.date.getDate()}
                </div>

                {dayEntries.slice(0, 2).map(e => {
                  const participantIds = entryMembers[e.id] || []
                  const names = participantIds.map(id => getMemberName(id))
                  const initials = buildInitials(names.length ? names : [getMemberName(e.created_by)])
                  const multi = isMultiDay(e)
                  const isStart = e.entry_date === ds
                  return (
                    <div key={e.id} style={{ fontSize: 10, padding: '2px 4px', marginBottom: 2, borderRadius: multi ? (isStart ? '4px 0 0 4px' : (e.end_date || e.entry_date) === ds ? '0 4px 4px 0' : 0) : 3, overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 2, ...pillStyle(e) }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isStart && e.entry_time ? e.entry_time.slice(0,5) + ' ' : ''}{isStart ? e.title : '↔ ' + e.title}
                      </span>
                      {initials.slice(0, 3).map((ini, i) => (
                        <span key={i} style={{ fontSize: 7, fontWeight: 700, background: 'rgba(0,0,0,0.13)', borderRadius: '50%', width: 12, height: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ini}</span>
                      ))}
                    </div>
                  )
                })}
                {dayEntries.length > 2 && <div style={{ fontSize: 10, color: '#888780' }}>+{dayEntries.length - 2}</div>}

                {isPopupOpen && (
                  <div style={{ position: 'absolute', top: 26, ...(col >= 5 ? { right: 0 } : { left: 0 }), zIndex: 30, background: '#fff', border: '1px solid #d0d0cc', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 170, overflow: 'hidden' }}
                    onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: 11, color: '#888780', padding: '6px 10px 4px', borderBottom: '1px solid #f0f0ee', fontWeight: 500 }}>{ds}</div>
                    <div style={popupOptionStyle} onClick={() => { setDayPopup(null); setView('day'); setViewDate(new Date(ds + 'T12:00:00')) }}>
                      <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>📅</span> View day
                    </div>
                    <div style={popupOptionStyle} onClick={() => openNewEntry(ds, 'event')}>
                      <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>➕</span> Add event
                    </div>
                    <div style={popupOptionStyle} onClick={() => openNewEntry(ds, 'task')}>
                      <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>✅</span> Add task
                    </div>
                    {dayEntries.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, color: '#b0b0ac', padding: '4px 10px 2px', borderTop: '1px solid #f0f0ee' }}>Entries</div>
                        {dayEntries.map(e => (
                          <div key={e.id} style={{ ...popupOptionStyle, fontSize: 11 }}
                            onClick={() => { setDayPopup(null); openEditEntry(e) }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor(e), flexShrink: 0 }}></div>
                            <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>{e.title}</span>
                            <span style={{ fontSize: 10, color: '#b0b0ac' }}>edit</span>
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
    const sameDay = !form.end_date || form.end_date === form.entry_date
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
        onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e4', padding: '1.5rem', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
          <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 14, color: '#2c2c2a' }}>
            {editEntry ? 'Edit entry' : 'New calendar entry'}
          </h3>

          {editEntry && (
            <div style={{ fontSize: 12, color: '#888780', marginBottom: 12 }}>
              Created by <strong>{getMemberName(editEntry.created_by)}</strong>
            </div>
          )}

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

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Title</label>
            <input type="text" value={form.title} placeholder="Entry title"
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Start date</label>
              <input type="date" value={form.entry_date}
                onChange={e => {
                  const newStart = e.target.value
                  setForm(p => ({
                    ...p,
                    entry_date: newStart,
                    // Clear end date if it's now before start date
                    end_date: p.end_date && p.end_date < newStart ? '' : p.end_date
                  }))
                }}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>End date <span style={{ color: '#b0b0ac', fontSize: 10 }}>(optional)</span></label>
              <input type="date" value={form.end_date}
                min={form.entry_date}
                onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Start time <span style={{ color: '#b0b0ac', fontSize: 10 }}>(optional)</span></label>
              <input type="time" value={form.entry_time}
                onChange={e => {
                  const newStart = e.target.value
                  setForm(p => ({
                    ...p,
                    entry_time: newStart,
                    // Clear end time if same day and end time is now <= start time
                    end_time: (sameDay && p.end_time && p.end_time <= newStart) ? '' : p.end_time
                  }))
                }}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>End time <span style={{ color: '#b0b0ac', fontSize: 10 }}>(optional)</span></label>
              <input type="time" value={form.end_time}
                min={sameDay && form.entry_time ? form.entry_time : undefined}
                onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Notes <span style={{ color: '#b0b0ac', fontSize: 10 }}>(optional)</span></label>
            <input type="text" value={form.notes} placeholder="Any notes"
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              style={inputStyle} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Participants</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {members.map((m, idx) => {
                const selected = form.participants.includes(m.user_id)
                const name = m.users?.display_name || m.users?.email?.split('@')[0] || '?'
                const initial = name[0]?.toUpperCase() || '?'
                const bg = AVATAR_BG[idx % AVATAR_BG.length]
                const tc = AVATAR_TC[idx % AVATAR_TC.length]
                return (
                  <div key={m.user_id} onClick={() => toggleParticipant(m.user_id)} title={name}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: selected ? bg : '#f0f0ee', color: selected ? tc : '#b0b0ac', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, border: selected ? `2px solid ${tc}` : '2px solid transparent', transition: 'all 0.15s', position: 'relative' }}>
                      {initial}
                      {selected && (
                        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: '#378ADD', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 7, color: '#fff', fontWeight: 700 }}>✓</span>
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: selected ? '#2c2c2a' : '#b0b0ac', fontWeight: selected ? 500 : 400, maxWidth: 44, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name.split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Validation error */}
          {formError && (
            <div style={{ background: '#FCEBEB', border: '1px solid #f5c2c2', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#A32D2D' }}>
              ⚠️ {formError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {editEntry && (
              <button onClick={() => deleteEntry(editEntry.id)}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer', fontSize: 13, marginRight: 'auto' }}>
                Delete
              </button>
            )}
            <button onClick={() => { setShowModal(false); setEditEntry(null); setFormError('') }}
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

function AvatarRow({ participantIds, members, size = 22, showNames = false }) {
  if (!participantIds || participantIds.length === 0) return null
  const names = participantIds.map(id => {
    const m = members.find(m => m.user_id === id)
    return m?.users?.display_name || m?.users?.email?.split('@')[0] || '?'
  })
  const initials = buildInitials(names)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: showNames ? 6 : 2 }}>
      {participantIds.map((id, i) => {
        const colorIdx = members.findIndex(m => m.user_id === id) % AVATAR_BG.length
        return (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: size, height: size, borderRadius: '50%', background: AVATAR_BG[colorIdx], color: AVATAR_TC[colorIdx], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.8)', marginLeft: i > 0 && !showNames ? -size * 0.3 : 0 }}>
              {initials[i] || '?'}
            </div>
            {showNames && <span style={{ fontSize: 11, color: '#888780' }}>{names[i]}</span>}
          </div>
        )
      })}
    </div>
  )
}

const btnStyle = { background: 'none', border: '1px solid #d0d0cc', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 13 }
const selectStyle = { padding: '6px 10px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 12, cursor: 'pointer', background: '#fff', color: '#2c2c2a' }
const primaryBtnStyle = { padding: '6px 14px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }
const popupOptionStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, color: '#2c2c2a', borderBottom: '0.5px solid #f8f8f6' }
const labelStyle = { fontSize: 12, color: '#888780', display: 'block', marginBottom: 4 }
const inputStyle = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 13, boxSizing: 'border-box', color: '#2c2c2a', background: '#fff' }
