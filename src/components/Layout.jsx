import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getUserSessions } from '../lib/session'
import Profile from '../pages/Profile'

const TABS = [
  { id: 'calendar',  label: 'Calendar',  icon: '📅' },
  { id: 'economy',   label: 'Economy',   icon: '💰' },
  { id: 'projects',  label: 'Projects',  icon: '📋' },
  { id: 'messages',  label: 'Messages',  icon: '💬' },
  { id: 'documents', label: 'Documents', icon: '📁' },
  { id: 'reports',   label: 'Reports',   icon: '📊' },
  { id: 'offers',    label: 'Offers',    icon: '🏷️' },
  { id: 'map',       label: 'Map',       icon: '📍' },
]

const MODE_COLORS = { family: '#FAEEDA', group: '#EAF3DE', team: '#E6F1FB' }
const MODE_TEXT   = { family: '#633806', group: '#27500A', team: '#0C447C' }
const MODE_ICONS  = { family: '👨‍👩‍👧‍👦', group: '👥', team: '💼' }

export default function Layout({ user, session, userRole, activeTab, setActiveTab, onSwitchSession, children }) {
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
  const [allSessions, setAllSessions] = useState([])
  const [profileOpen, setProfileOpen] = useState(false)
  const sessionMenuRef = useRef(null)

  useEffect(() => { loadAllSessions() }, [user])

  useEffect(() => {
    function handleClick(e) {
      if (sessionMenuRef.current && !sessionMenuRef.current.contains(e.target)) {
        setSessionMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadAllSessions() {
    try {
      const data = await getUserSessions(user.id)
      setAllSessions(data)
    } catch (e) { console.error(e) }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  function handleSessionSwitch(sess, role) {
    setSessionMenuOpen(false)
    onSwitchSession(sess, role)
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", minHeight: '100vh', background: '#f8f8f6' }}>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8e8e4', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>🏠</span>

        {/* Session switcher */}
        <div ref={sessionMenuRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <button onClick={() => setSessionMenuOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 8, border: '1px solid #e8e8e4', background: sessionMenuOpen ? '#f0f8ff' : '#f8f8f6', cursor: 'pointer', maxWidth: '100%' }}>
            <span style={{ fontSize: 14 }}>{MODE_ICONS[session?.mode] || '🏠'}</span>
            <div style={{ textAlign: 'left', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#2c2c2a', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 160 }}>{session?.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: MODE_COLORS[session?.mode] || '#f0f0ee', color: MODE_TEXT[session?.mode] || '#888780', fontWeight: 500, textTransform: 'capitalize' }}>{session?.mode}</span>
                {userRole === 'admin' && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: '#FCEBEB', color: '#A32D2D', fontWeight: 500 }}>Admin</span>}
              </div>
            </div>
            <span style={{ fontSize: 10, color: '#888780', marginLeft: 2 }}>{sessionMenuOpen ? '▲' : '▼'}</span>
          </button>

          {sessionMenuOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 260, background: '#fff', border: '1px solid #e8e8e4', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px 4px', fontSize: 11, color: '#888780', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em' }}>Your sessions</div>
              {allSessions.map(s => {
                const isActive = s.sessions?.id === session?.id
                return (
                  <div key={s.session_id} onClick={() => !isActive && handleSessionSwitch(s.sessions, s.role)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: isActive ? 'default' : 'pointer', background: isActive ? '#f0f8ff' : 'none', borderLeft: isActive ? '3px solid #378ADD' : '3px solid transparent' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: MODE_COLORS[s.sessions?.mode] || '#f0f0ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      {MODE_ICONS[s.sessions?.mode] || '🏠'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: isActive ? 500 : 400, color: '#2c2c2a', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{s.sessions?.name}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                        <span style={{ fontSize: 10, color: '#888780', textTransform: 'capitalize' }}>{s.sessions?.mode}</span>
                        <span style={{ fontSize: 10, color: '#888780' }}>·</span>
                        <span style={{ fontSize: 10, color: s.role === 'admin' ? '#A32D2D' : '#888780' }}>{s.role}</span>
                      </div>
                    </div>
                    {isActive && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#E6F1FB', color: '#0C447C', fontWeight: 500 }}>Active</span>}
                  </div>
                )
              })}
              <div style={{ borderTop: '1px solid #e8e8e4', padding: '6px 8px' }}>
                <button onClick={() => { setSessionMenuOpen(false); onSwitchSession(null, null) }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#378ADD', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                  ➕ Create or join another session
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Invite code */}
        {session?.invite_code && (
          <div onClick={() => { navigator.clipboard?.writeText(session.invite_code); alert('Invite code copied: ' + session.invite_code) }}
            style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: '#f0f0ee', color: '#888780', fontFamily: 'monospace', cursor: 'pointer', flexShrink: 0, border: '1px solid #e8e8e4', whiteSpace: 'nowrap' }}
            title="Click to copy invite code">
            📋 {session.invite_code}
          </div>
        )}

        {/* Avatar — opens profile */}
        <button onClick={() => setProfileOpen(true)}
          style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid #e8e8e4', background: '#E6F1FB', color: '#0C447C', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color .15s' }}
          title="My profile & settings">
          {user?.email?.slice(0, 2).toUpperCase()}
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8e8e4', display: 'flex', overflowX: 'auto', padding: '0 8px' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '9px 12px', fontSize: 12, cursor: 'pointer', border: 'none', background: 'none', color: activeTab === tab.id ? '#2c2c2a' : '#888780', borderBottom: activeTab === tab.id ? '2px solid #378ADD' : '2px solid transparent', marginBottom: -1, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, fontWeight: activeTab === tab.id ? 500 : 400 }}>
            <span style={{ fontSize: 13 }}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* Session isolation notice */}
      <div style={{ background: '#f8f8f6', borderBottom: '1px solid #f0f0ee', padding: '4px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#b0b0ac' }}>Viewing:</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: MODE_TEXT[session?.mode] || '#888780', background: MODE_COLORS[session?.mode] || '#f0f0ee', padding: '1px 7px', borderRadius: 6 }}>
          {MODE_ICONS[session?.mode]} {session?.name}
        </span>
        <span style={{ fontSize: 10, color: '#b0b0ac', marginLeft: 'auto' }}>🔒 Isolated session</span>
      </div>

      {/* Content */}
      <div style={{ padding: '1rem' }}>{children}</div>

      {/* Profile panel */}
      {profileOpen && <Profile user={user} onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
