import { useState, useEffect } from 'react'
import { getUserSessions } from '../lib/session'

const MODE_ICONS = { family: '👨‍👩‍👧‍👦', group: '👥', team: '💼' }
const MODE_COLORS = { family: '#E6F1FB', group: '#E1F5EE', team: '#EEEDFE' }

export default function SessionPicker({ user, onSelect, onCreateNew }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUserSessions(user.id).then(data => {
      setSessions(data)
      // Auto-select if only one session
      if (data.length === 1) onSelect(data[0].sessions, data[0].role)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f6' }}>
      <div style={{ color: '#888780', fontSize: 14 }}>Loading your sessions...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f6', padding: '1rem' }}>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8e8e4', padding: '2rem', width: '100%', maxWidth: 420 }}>
        <div style={{ fontSize: 32, marginBottom: 8, textAlign: 'center' }}>👋</div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#2c2c2a', marginBottom: 4, textAlign: 'center' }}>Welcome back</h2>
        <p style={{ fontSize: 13, color: '#888780', marginBottom: 20, textAlign: 'center' }}>Choose a session to open</p>

        {sessions.map(s => (
          <div key={s.session_id}
            onClick={() => onSelect(s.sessions, s.role)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', border: '1px solid #e8e8e4', borderRadius: 12, marginBottom: 8, cursor: 'pointer' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: MODE_COLORS[s.sessions.mode] || '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {MODE_ICONS[s.sessions.mode] || '🏠'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#2c2c2a' }}>{s.sessions.name}</div>
              <div style={{ fontSize: 11, color: '#888780', marginTop: 2, display: 'flex', gap: 6 }}>
                <span style={{ textTransform: 'capitalize' }}>{s.sessions.mode}</span>
                <span>·</span>
                <span style={{ padding: '1px 6px', borderRadius: 8, background: s.role === 'admin' ? '#FCEBEB' : '#f0f0ee', color: s.role === 'admin' ? '#A32D2D' : '#888780', fontSize: 10 }}>
                  {s.role}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 18, color: '#d0d0cc' }}>›</div>
          </div>
        ))}

        <button
          onClick={onCreateNew}
          style={{ width: '100%', padding: 11, borderRadius: 8, border: '1px solid #d0d0cc', background: 'none', fontSize: 13, cursor: 'pointer', color: '#378ADD', marginTop: 8 }}>
          + Create or join another session
        </button>
      </div>
    </div>
  )
}
