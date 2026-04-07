import { useState, useEffect } from 'react'
import { getUserSessions } from '../lib/session'

const MODE_ICONS = { family: '👨‍👩‍👧‍👦', group: '👥', team: '💼' }
const MODE_COLORS = { family: '#E6F1FB', group: '#E1F5EE', team: '#EEEDFE' }

// Detect mobile device
function isMobileDevice() {
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)
}

// Detect iOS specifically
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

// Detect if already installed as PWA
function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
}

export default function SessionPicker({ user, onSelect, onCreateNew }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [installPrompt, setInstallPrompt] = useState(null) // Android deferred prompt
  const [showInstall, setShowInstall] = useState(false)
  const [installDismissed, setInstallDismissed] = useState(false)

  useEffect(() => {
    getUserSessions(user.id).then(data => {
      setSessions(data)
      if (data.length === 1) onSelect(data[0].sessions, data[0].role)
      setLoading(false)
    }).catch(() => setLoading(false))

    // Only show install prompt on mobile and if not already installed
    if (isMobileDevice() && !isInstalled()) {
      if (isIOS()) {
        // iOS — show manual instructions
        setShowInstall(true)
      } else {
        // Android — catch the browser's install event
        const handler = (e) => {
          e.preventDefault()
          setInstallPrompt(e)
          setShowInstall(true)
        }
        window.addEventListener('beforeinstallprompt', handler)
        return () => window.removeEventListener('beforeinstallprompt', handler)
      }
    }
  }, [])

  async function handleInstall() {
    if (installPrompt) {
      // Android — trigger native install dialog
      installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') setShowInstall(false)
      setInstallPrompt(null)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f6' }}>
      <div style={{ color: '#888780', fontSize: 14 }}>Loading your sessions...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f6', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Install banner — mobile only, not already installed, not dismissed */}
        {showInstall && !installDismissed && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #97C459', padding: '14px 16px', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#378ADD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                🏠
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2c2a', marginBottom: 2 }}>
                  Install Family App
                </div>
                {isIOS() ? (
                  <div style={{ fontSize: 11, color: '#888780', lineHeight: 1.5 }}>
                    Tap <strong>Share</strong> <span style={{ fontSize: 13 }}>⎋</span> at the bottom of Safari, then <strong>"Add to Home Screen"</strong>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#888780', lineHeight: 1.5 }}>
                    Add to your home screen for the best experience
                  </div>
                )}
              </div>
              <button onClick={() => setInstallDismissed(true)}
                style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#b0b0ac', flexShrink: 0, padding: 0, lineHeight: 1 }}>✕</button>
            </div>

            {/* Android install button */}
            {!isIOS() && installPrompt && (
              <button onClick={handleInstall}
                style={{ width: '100%', marginTop: 10, padding: '9px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                📲 Install now
              </button>
            )}
          </div>
        )}

        {/* Main card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8e8e4', padding: '2rem' }}>
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

          <button onClick={onCreateNew}
            style={{ width: '100%', padding: 11, borderRadius: 8, border: '1px solid #d0d0cc', background: 'none', fontSize: 13, cursor: 'pointer', color: '#378ADD', marginTop: 8 }}>
            + Create or join another session
          </button>
        </div>
      </div>
    </div>
  )
}
