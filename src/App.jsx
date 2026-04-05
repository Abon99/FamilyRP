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

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [appState, setAppState] = useState('checking')
  const [currentSession, setCurrentSession] = useState(null)
  const [userRole, setUserRole] = useState('member')
  const [activeTab, setActiveTab] = useState('calendar')

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

  // Called when user picks a session from the dropdown or picker
  function handleSessionSelect(sess, role) {
    if (!sess) {
      // null = create/join new session
      setAppState('onboarding')
      return
    }
    setCurrentSession(sess)
    setUserRole(role || 'member')
    setActiveTab('calendar') // reset to calendar on session switch
    setAppState('app')
  }

  function renderTab() {
    const props = { user: session?.user, session: currentSession, userRole }
    switch (activeTab) {
      case 'calendar':   return <Calendar {...props} />
      case 'economy':    return <Economy {...props} />
      case 'projects':   return <Projects {...props} />
      case 'messages':   return <Messages {...props} />
      case 'documents':  return <Documents {...props} />
      case 'reports':    return <Reports {...props} />
      case 'offers':     return <Offers {...props} />
      default:           return <ComingSoon name={activeTab} />
    }
  }

  if (loading) return <Splash />
  if (appState === 'login') return <Login />
  if (appState === 'onboarding') return (
    <Onboarding user={session.user} onComplete={() => checkUserSessions(session.user)} />
  )
  if (appState === 'picker') return (
    <SessionPicker
      user={session.user}
      onSelect={handleSessionSelect}
      onCreateNew={() => setAppState('onboarding')}
    />
  )

  return (
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
