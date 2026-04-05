import { useState } from 'react'
import { createSession, joinSession } from '../lib/session'

export default function Onboarding({ user, onComplete }) {
  const [step, setStep] = useState('choice') // choice | create | join | done
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [mode, setMode] = useState('family')
  const [inviteCode, setInviteCode] = useState('')
  const [createdCode, setCreatedCode] = useState('')

  async function handleCreate() {
    if (!displayName.trim()) { setError('Please enter your name'); return }
    if (!sessionName.trim()) { setError('Please enter a session name'); return }
    setLoading(true); setError('')
    try {
      const session = await createSession(sessionName, mode, user.id, displayName)
      setCreatedCode(session.invite_code)
      setStep('created')
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  async function handleJoin() {
    if (!displayName.trim()) { setError('Please enter your name'); return }
    if (!inviteCode.trim()) { setError('Please enter the invite code'); return }
    setLoading(true); setError('')
    try {
      await joinSession(inviteCode, user.id, displayName)
      onComplete()
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const modes = [
    { id: 'family', icon: '👨‍👩‍👧‍👦', label: 'Family', sub: 'Parents & kids' },
    { id: 'group',  icon: '👥', label: 'Group',  sub: 'Friends & social' },
    { id: 'team',   icon: '💼', label: 'Team',   sub: 'Work & projects' },
  ]

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logo}>🏠</div>
        <h1 style={s.title}>Family App</h1>

        {step === 'choice' && (
          <>
            <p style={s.sub}>Welcome! Get started by creating a new session or joining an existing one.</p>
            <button style={s.btnPrimary} onClick={() => setStep('create')}>Create a new session</button>
            <button style={s.btnOutline} onClick={() => setStep('join')}>Join with an invite code</button>
          </>
        )}

        {step === 'create' && (
          <>
            <p style={s.sub}>Set up your session in a few steps.</p>
            <div style={s.formRow}>
              <label style={s.label}>Your display name</label>
              <input style={s.input} placeholder="e.g. Alex" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div style={s.formRow}>
              <label style={s.label}>Session name</label>
              <input style={s.input} placeholder="e.g. Henderson Family" value={sessionName} onChange={e => setSessionName(e.target.value)} />
            </div>
            <div style={s.formRow}>
              <label style={s.label}>Session type</label>
              <div style={s.modeGrid}>
                {modes.map(m => (
                  <div key={m.id} style={{ ...s.modeCard, ...(mode === m.id ? s.modeActive : {}) }}
                    onClick={() => setMode(m.id)}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{m.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{m.label}</div>
                    <div style={{ fontSize: 10, color: '#888780' }}>{m.sub}</div>
                  </div>
                ))}
              </div>
            </div>
            {error && <p style={s.error}>{error}</p>}
            <button style={s.btnPrimary} onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating...' : 'Create session'}
            </button>
            <button style={s.btnGhost} onClick={() => { setStep('choice'); setError('') }}>← Back</button>
          </>
        )}

        {step === 'created' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <p style={{ ...s.sub, fontWeight: 500, color: '#2c2c2a' }}>"{sessionName}" is ready!</p>
            <p style={s.sub}>Share this code with family members so they can join:</p>
            <div style={s.codeBox}>
              <div style={s.codeVal}>{createdCode}</div>
              <div style={{ fontSize: 11, color: '#888780', marginTop: 4 }}>Invite code</div>
            </div>
            <button style={s.btnPrimary} onClick={onComplete}>Go to my session →</button>
          </>
        )}

        {step === 'join' && (
          <>
            <p style={s.sub}>Enter the invite code shared by your session admin.</p>
            <div style={s.formRow}>
              <label style={s.label}>Your display name</label>
              <input style={s.input} placeholder="e.g. Jordan" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div style={s.formRow}>
              <label style={s.label}>Invite code</label>
              <input style={{ ...s.input, textAlign: 'center', letterSpacing: 4, fontSize: 18, fontFamily: 'monospace' }}
                placeholder="FA-1234" value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())} />
            </div>
            {error && <p style={s.error}>{error}</p>}
            <button style={s.btnPrimary} onClick={handleJoin} disabled={loading}>
              {loading ? 'Joining...' : 'Join session'}
            </button>
            <button style={s.btnGhost} onClick={() => { setStep('choice'); setError('') }}>← Back</button>
          </>
        )}

        <p style={s.privacy}>🔒 GDPR + Quebec Law 25 compliant</p>
      </div>
    </div>
  )
}

const s = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f6', padding: '1rem' },
  card: { background: '#fff', borderRadius: 16, border: '1px solid #e8e8e4', padding: '2rem', width: '100%', maxWidth: 420, textAlign: 'center' },
  logo: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: 600, color: '#2c2c2a', marginBottom: 4 },
  sub: { fontSize: 13, color: '#888780', lineHeight: 1.6, marginBottom: 20 },
  formRow: { marginBottom: 14, textAlign: 'left' },
  label: { fontSize: 12, color: '#888780', display: 'block', marginBottom: 4 },
  input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 13, boxSizing: 'border-box', color: '#2c2c2a' },
  modeGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 4 },
  modeCard: { border: '1px solid #d0d0cc', borderRadius: 8, padding: '10px 6px', cursor: 'pointer', textAlign: 'center' },
  modeActive: { border: '1px solid #378ADD', background: '#E6F1FB' },
  btnPrimary: { width: '100%', padding: 12, borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginBottom: 8 },
  btnOutline: { width: '100%', padding: 11, borderRadius: 8, border: '1px solid #d0d0cc', background: 'none', fontSize: 13, cursor: 'pointer', color: '#2c2c2a', marginBottom: 8 },
  btnGhost: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#378ADD', padding: '4px 0' },
  codeBox: { background: '#f8f8f6', border: '1px dashed #d0d0cc', borderRadius: 12, padding: '1.25rem', margin: '1rem 0' },
  codeVal: { fontSize: 28, fontWeight: 600, letterSpacing: 6, fontFamily: 'monospace', color: '#2c2c2a' },
  error: { fontSize: 12, color: '#E24B4A', marginBottom: 10, textAlign: 'left' },
  privacy: { fontSize: 11, color: '#b0b0ac', marginTop: 20 }
}
