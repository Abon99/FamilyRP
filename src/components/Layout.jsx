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

// Simple hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

export default function Layout({ user, session, userRole, activeTab, setActiveTab, onSwitchSession, children }) {
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false)
  const [allSessions, setAllSessions] = useState([])
  const [profileOpen, setProfileOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const sessionMenuRef = useRef(null)
  const isMobile = useIsMobile()

  // On mobile, first 4 tabs in bottom bar, rest in "More"
  const PRIMARY_TABS = isMobile ? TABS.slice(0, 4) : TABS
  const MORE_TABS = isMobile ? TABS.slice(4) : []

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

  function handleSessionSwitch(sess, role) {
    setSessionMenuOpen(false)
    onSwitchSession(sess, role)
  }

  const inviteLink = `https://abon99.github.io/FamilyRP?invite=${session?.invite_code}`
  const inviteText = `Join my "${session?.name}" session on Family App!`
  const canShare = !!navigator.share

  function handleNativeShare() {
    if (navigator.share) {
      navigator.share({ title: 'Join my Family App session', text: inviteText, url: inviteLink })
    }
  }

  function handleCopy() {
    navigator.clipboard?.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isMoreActive = MORE_TABS.some(t => t.id === activeTab)

  return (
    <div style={{
      maxWidth: 960, margin: '0 auto',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      minHeight: '100vh', background: '#f8f8f6',
      // On mobile add bottom padding for fixed tab bar
      paddingBottom: isMobile ? 60 : 0
    }}>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8e8e4', padding: isMobile ? '6px 10px' : '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>🏠</span>

        {/* Session switcher */}
        <div ref={sessionMenuRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <button onClick={() => setSessionMenuOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 8, border: '1px solid #e8e8e4', background: sessionMenuOpen ? '#f0f8ff' : '#f8f8f6', cursor: 'pointer', maxWidth: '100%' }}>
            <span style={{ fontSize: 13 }}>{MODE_ICONS[session?.mode] || '🏠'}</span>
            <div style={{ textAlign: 'left', minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 500, color: '#2c2c2a', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: isMobile ? 100 : 160 }}>{session?.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: MODE_COLORS[session?.mode] || '#f0f0ee', color: MODE_TEXT[session?.mode] || '#888780', fontWeight: 500, textTransform: 'capitalize' }}>{session?.mode}</span>
                {userRole === 'admin' && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: '#FCEBEB', color: '#A32D2D', fontWeight: 500 }}>Admin</span>}
              </div>
            </div>
            <span style={{ fontSize: 10, color: '#888780' }}>{sessionMenuOpen ? '▲' : '▼'}</span>
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

        {/* Invite button */}
        {session?.invite_code && (
          <button onClick={() => setInviteOpen(true)}
            style={{ fontSize: 11, padding: '5px 8px', borderRadius: 8, background: '#EAF3DE', color: '#27500A', border: '1px solid #97C459', cursor: 'pointer', flexShrink: 0, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
            👋 {isMobile ? '' : 'Invite'}
          </button>
        )}

        {/* Avatar */}
        <button onClick={() => setProfileOpen(true)}
          style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #e8e8e4', background: '#E6F1FB', color: '#0C447C', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {user?.email?.slice(0, 2).toUpperCase()}
        </button>
      </div>

      {/* Tab bar — desktop: horizontal scroll, mobile: fixed bottom */}
      {isMobile ? (
        // Mobile bottom tab bar
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e8e8e4', display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {PRIMARY_TABS.map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMoreOpen(false) }}
              style={{ flex: 1, padding: '8px 4px 6px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              <span style={{ fontSize: 9, color: activeTab === tab.id ? '#378ADD' : '#888780', fontWeight: activeTab === tab.id ? 600 : 400 }}>{tab.label}</span>
              {activeTab === tab.id && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#378ADD' }}></div>}
            </button>
          ))}
          {/* More button */}
          <div style={{ position: 'relative', flex: 1 }}>
            <button onClick={() => setMoreOpen(v => !v)}
              style={{ width: '100%', padding: '8px 4px 6px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 20 }}>⋯</span>
              <span style={{ fontSize: 9, color: isMoreActive || moreOpen ? '#378ADD' : '#888780', fontWeight: isMoreActive || moreOpen ? 600 : 400 }}>More</span>
              {isMoreActive && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#378ADD' }}></div>}
            </button>
            {moreOpen && (
              <div style={{ position: 'absolute', bottom: '100%', right: 0, background: '#fff', border: '1px solid #e8e8e4', borderRadius: 12, boxShadow: '0 -4px 16px rgba(0,0,0,0.1)', overflow: 'hidden', minWidth: 160, zIndex: 110 }}>
                {MORE_TABS.map(tab => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMoreOpen(false) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', border: 'none', background: activeTab === tab.id ? '#f0f8ff' : 'none', cursor: 'pointer', fontSize: 13, color: activeTab === tab.id ? '#378ADD' : '#2c2c2a', fontWeight: activeTab === tab.id ? 500 : 400 }}>
                    <span style={{ fontSize: 16 }}>{tab.icon}</span>{tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        // Desktop horizontal tab bar
        <div style={{ background: '#fff', borderBottom: '1px solid #e8e8e4', display: 'flex', overflowX: 'auto', padding: '0 8px' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: '9px 12px', fontSize: 12, cursor: 'pointer', border: 'none', background: 'none', color: activeTab === tab.id ? '#2c2c2a' : '#888780', borderBottom: activeTab === tab.id ? '2px solid #378ADD' : '2px solid transparent', marginBottom: -1, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, fontWeight: activeTab === tab.id ? 500 : 400 }}>
              <span style={{ fontSize: 13 }}>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Session isolation notice */}
      <div style={{ background: '#f8f8f6', borderBottom: '1px solid #f0f0ee', padding: '4px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#b0b0ac' }}>Viewing:</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: MODE_TEXT[session?.mode] || '#888780', background: MODE_COLORS[session?.mode] || '#f0f0ee', padding: '1px 7px', borderRadius: 6 }}>
          {MODE_ICONS[session?.mode]} {session?.name}
        </span>
        <span style={{ fontSize: 10, color: '#b0b0ac', marginLeft: 'auto' }}>🔒 Isolated session</span>
      </div>

      {/* Content */}
      <div style={{ padding: isMobile ? '0.75rem' : '1rem' }}>{children}</div>

      {/* Profile panel */}
      {profileOpen && <Profile user={user} onClose={() => setProfileOpen(false)} />}

      {/* Invite popup */}
      {inviteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
          onClick={e => { if (e.target === e.currentTarget) setInviteOpen(false) }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 36px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e0e0dc', margin: '0 auto 18px' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#2c2c2a' }}>Invite someone</div>
                <div style={{ fontSize: 12, color: '#888780', marginTop: 2 }}>to <strong>{session?.name}</strong></div>
              </div>
              <button onClick={() => setInviteOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888780', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ background: '#f4f4f2', borderRadius: 10, padding: '10px 12px', marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#b0b0ac', marginBottom: 3 }}>Invite link</div>
              <div style={{ fontSize: 11, color: '#888780', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{inviteLink}</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {canShare && (
                <button onClick={handleNativeShare}
                  style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: '#378ADD', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>📲</span> Share
                </button>
              )}
              <button onClick={handleCopy}
                style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid #e8e8e4', background: copied ? '#EAF3DE' : '#f8f8f6', color: copied ? '#27500A' : '#2c2c2a', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}>
                <span style={{ fontSize: 20 }}>{copied ? '✅' : '📋'}</span>
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </div>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <span style={{ fontSize: 11, color: '#b0b0ac' }}>Or share the code manually: </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#2c2c2a', fontFamily: 'monospace', background: '#f4f4f2', padding: '2px 8px', borderRadius: 6 }}>{session?.invite_code}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
