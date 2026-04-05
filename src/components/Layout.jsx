import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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

export default function Layout({ user, session, userRole, activeTab, setActiveTab, onSwitchSession, children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", minHeight: '100vh', background: '#f8f8f6' }}>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8e8e4', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 20 }}>🏠</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#2c2c2a', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {session?.name}
            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: MODE_COLORS[session?.mode] || '#f0f0ee', color: MODE_TEXT[session?.mode] || '#888780', fontWeight: 500, textTransform: 'capitalize' }}>
              {session?.mode}
            </span>
            {userRole === 'admin' && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: '#FCEBEB', color: '#A32D2D', fontWeight: 500 }}>Admin</span>}
          </div>
          <div style={{ fontSize: 11, color: '#888780' }}>{user?.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {session?.invite_code && (
            <div style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: '#f0f0ee', color: '#888780', fontFamily: 'monospace', cursor: 'pointer' }}
              onClick={() => { navigator.clipboard?.writeText(session.invite_code); alert('Invite code copied: ' + session.invite_code) }}
              title="Click to copy invite code">
              📋 {session.invite_code}
            </div>
          )}
          <button onClick={onSwitchSession} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #d0d0cc', background: 'none', cursor: 'pointer', color: '#888780' }}>
            Switch
          </button>
          <button onClick={handleSignOut} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #d0d0cc', background: 'none', cursor: 'pointer', color: '#888780' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8e8e4', display: 'flex', overflowX: 'auto', padding: '0 8px' }}>
        {TABS.map(tab => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ padding: '9px 12px', fontSize: 12, cursor: 'pointer', border: 'none', background: 'none', color: activeTab === tab.id ? '#2c2c2a' : '#888780', borderBottom: activeTab === tab.id ? '2px solid #378ADD' : '2px solid transparent', marginBottom: -1, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4, fontWeight: activeTab === tab.id ? 500 : 400 }}>
            <span style={{ fontSize: 13 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '1rem' }}>
        {children}
      </div>
    </div>
  )
}
