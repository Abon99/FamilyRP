import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import SessionPicker from './pages/SessionPicker'
import Layout from './components/Layout'
import Calendar from './pages/Calendar'
import Economy from './pages/Economy'
import Projects from './pages/Projects'
import Messages from './pages/Messages'
import Documents from './pages/Documents'
import Reports from './pages/Reports'
import Offers from './pages/Offers'
import ComingSoon from './pages/ComingSoon'

// Detect in-app browsers
function detectInAppBrowser() {
  const ua = navigator.userAgent || ''
  const isAndroid = /android/i.test(ua)
  const isIOS = /iphone|ipad|ipod/i.test(ua)

  const inApp =
    /FBAN|FBAV|FB_IAB|FB4A|FBIOS/i.test(ua) ||   // Facebook / Messenger
    /Instagram/i.test(ua) ||                        // Instagram
    /WhatsApp/i.test(ua) ||                         // WhatsApp
    /Snapchat/i.test(ua) ||                         // Snapchat
    /TikTok/i.test(ua) ||                           // TikTok
    /Twitter/i.test(ua) ||                          // Twitter/X
    /LinkedInApp/i.test(ua) ||                      // LinkedIn
    /Line\//i.test(ua)                              // Line

  if (!inApp) return null
  if (isIOS) return 'ios'
  if (isAndroid) return 'android'
  return 'unknown'
}

function InAppBrowserBanner({ onDismiss }) {
  const type = detectInAppBrowser()
  const [visible, setVisible] = useState(!!type)

  if (!visible || !type) return null

  const currentUrl = window.location.href

  function openInBrowser() {
    if (type === 'android') {
      // Android intent to open in Chrome
      window.location.href = `intent://${currentUrl.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
    } else {
      // iOS — can't force open, show instructions
    }
  }

  function dismiss() {
    setVisible(false)
    if (onDismiss) onDismiss()
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#1a1a1a', color: '#fff',
      padding: '10px 14px',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>🌐</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>
          Open in your browser for the best experience
        </div>
        {type === 'ios' ? (
          <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.5 }}>
            Tap <strong>⋯</strong> or the <strong>share icon</strong> at the bottom of the screen, then choose <strong>"Open in Safari"</strong>
          </div>
        ) : type === 'android' ? (
          <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>Tap to open in Chrome</span>
            <button
              onClick={openInBrowser}
              style={{ background: '#378ADD', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, padding: '4px 10px', cursor: 'pointer', fontWeight: 500 }}>
              Open in Chrome
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.5 }}>
            Copy the link and paste it into your browser for the full experience.
          </div>
        )}
        {/* Copy link button — always shown */}
        <button
          onClick={() => { navigator.clipboard?.writeText(currentUrl); alert('Link copied! Paste it in your browser.') }}
          style={{ marginTop: 6, background: 'none', border: '1px solid #555', borderRadius: 6, color: '#ccc', fontSize: 11, padding: '3px 10px', cursor: 'pointer' }}>
          📋 Copy link
        </button>
      </div>
      <button onClick={dismiss}
        style={{ background: 'none', border: 'none', color: '#888', fontSize: 18, cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: 0 }}>
        ✕
      </button>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [appState, setAppState] = useState('checking')
  const [currentSession, setCurrentSession] = useState(null)
  const [userRole, setUserRole] = useState('member')
  const [activeTab, setActiveTab] = useState('calendar')
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) checkUserSessions(session.user)
      else { setAppState('login'); setLoading(false) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) checkUserSessions(session.user)
      else { setAppState('login'); setCurrentSession(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function checkUserSessions(user) {
    setLoading(true)
    const { data } = await supabase
      .from('session_members')
      .select('session_id, role, sessions(id, name, mode, invite_code)')
      .eq('user_id', user.id)

    if (!data || data.length === 0) {
      setAppState('onboarding')
    } else if (data.length === 1) {
      setCurrentSession(data[0].sessions)
      setUserRole(data[0].role)
      setAppState('app')
    } else {
      setAppState('picker')
    }
    setLoading(false)
  }

  function handleSessionSelect(sess, role) {
    if (!sess) {
      setAppState('onboarding')
      return
    }
    setCurrentSession(sess)
    setUserRole(role || 'member')
    setActiveTab('calendar')
    setAppState('app')
  }

  function renderTab() {
    const props = { user: session?.user, session: currentSession, userRole }
    switch (activeTab) {
      case 'calendar':   return <Calendar key={currentSession?.id} {...props} />
      case 'economy':    return <Economy key={currentSession?.id} {...props} />
      case 'projects':   return <Projects key={currentSession?.id} {...props} />
      case 'messages':   return <Messages key={currentSession?.id} {...props} />
      case 'documents':  return <Documents key={currentSession?.id} {...props} />
      case 'reports':    return <Reports key={currentSession?.id} {...props} />
      case 'offers':     return <Offers key={currentSession?.id} {...props} />
      default:           return <ComingSoon name={activeTab} />
    }
  }

  const showBanner = !bannerDismissed && !!detectInAppBrowser()

  if (loading) return <Splash />
  if (appState === 'login') return (
    <>
      {showBanner && <InAppBrowserBanner onDismiss={() => setBannerDismissed(true)} />}
      <div style={{ marginTop: showBanner ? 100 : 0 }}><Login /></div>
    </>
  )
  if (appState === 'onboarding') return (
    <>
      {showBanner && <InAppBrowserBanner onDismiss={() => setBannerDismissed(true)} />}
      <div style={{ marginTop: showBanner ? 100 : 0 }}>
        <Onboarding user={session.user} onComplete={() => checkUserSessions(session.user)} />
      </div>
    </>
  )
  if (appState === 'picker') return (
    <>
      {showBanner && <InAppBrowserBanner onDismiss={() => setBannerDismissed(true)} />}
      <div style={{ marginTop: showBanner ? 100 : 0 }}>
        <SessionPicker
          user={session.user}
          onSelect={handleSessionSelect}
          onCreateNew={() => setAppState('onboarding')}
        />
      </div>
    </>
  )

  return (
    <>
      {showBanner && <InAppBrowserBanner onDismiss={() => setBannerDismissed(true)} />}
      <div style={{ marginTop: showBanner ? 100 : 0 }}>
        <Layout
          user={session.user}
          session={currentSession}
          userRole={userRole}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onSwitchSession={handleSessionSelect}
        >
          {renderTab()}
        </Layout>
      </div>
    </>
  )
}

function Splash() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f6' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
        <div style={{ fontSize: 14, color: '#888780' }}>Loading Family App...</div>
      </div>
    </div>
  )
}
