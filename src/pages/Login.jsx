import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const TABS = ['login', 'signup', 'magic']
const TAB_LABELS = { login: 'Sign in', signup: 'Create account', magic: 'Magic link' }

export default function Login() {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  function reset() { setError(''); setSuccess('') }

  async function handleLogin(e) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) { setError('Please enter your email and password'); return }
    setLoading(true); reset()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      if (error.message.includes('Invalid login')) {
        setError('Incorrect email or password. Please try again.')
      } else {
        setError(error.message)
      }
    }
    // On success, App.jsx auth listener handles redirect automatically
    setLoading(false)
  }

  async function handleSignUp(e) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) { setError('Please enter your email and password'); return }
    if (!displayName.trim()) { setError('Please enter your display name'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); reset()

    // Sign up with Supabase auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName }
      }
    })

    if (error) {
      setError(error.message)
    } else if (data.user) {
      // Create user profile
      await supabase.from('users').upsert({
        id: data.user.id,
        display_name: displayName,
        email: email
      })
      if (data.session) {
        // Logged in immediately (email confirmation disabled)
        // App.jsx handles redirect
      } else {
        setSuccess('Account created! Please check your email to confirm your address, then sign in.')
        setTab('login')
      }
    }
    setLoading(false)
  }

  async function handleMagicLink(e) {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email address'); return }
    setLoading(true); reset()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    })
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Magic link sent! Check your email and click the link to sign in.')
    }
    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Enter your email address above first'); return }
    setLoading(true); reset()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    })
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Password reset email sent! Check your inbox.')
    }
    setLoading(false)
  }

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <div style={s.logoIcon}>🏠</div>
          <h1 style={s.title}>Family App</h1>
          <p style={s.sub}>Quebec, Canada</p>
        </div>

        {/* Tab switcher */}
        <div style={s.tabs}>
          {TABS.map(t => (
            <button key={t} style={{ ...s.tabBtn, ...(tab === t ? s.tabActive : {}) }}
              onClick={() => { setTab(t); reset() }}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Success message */}
        {success && (
          <div style={s.successBox}>
            <span style={{ fontSize: 16 }}>✅</span>
            <span>{success}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div style={s.errorBox}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* SIGN IN TAB */}
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div style={s.formRow}>
              <label style={s.label}>Email address</label>
              <input style={s.input} type="email" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div style={s.formRow}>
              <label style={s.label}>Password</label>
              <div style={s.passwordWrap}>
                <input style={{ ...s.input, paddingRight: 44 }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(v => !v)} style={s.eyeBtn}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div style={s.rememberRow}>
              <label style={s.checkLabel}>
                <input type="checkbox" checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{ marginRight: 6, accentColor: '#378ADD' }} />
                Keep me signed in for 30 days
              </label>
              <button type="button" onClick={handleForgotPassword} style={s.linkBtn}>
                Forgot password?
              </button>
            </div>

            <button style={s.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>

            <p style={s.switchText}>
              No account yet?{' '}
              <button type="button" style={s.linkBtn} onClick={() => { setTab('signup'); reset() }}>
                Create one
              </button>
            </p>
          </form>
        )}

        {/* SIGN UP TAB */}
        {tab === 'signup' && (
          <form onSubmit={handleSignUp}>
            <div style={s.formRow}>
              <label style={s.label}>Your name</label>
              <input style={s.input} type="text" placeholder="e.g. Jesper"
                value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div style={s.formRow}>
              <label style={s.label}>Email address</label>
              <input style={s.input} type="email" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div style={s.formRow}>
              <label style={s.label}>Password</label>
              <div style={s.passwordWrap}>
                <input style={{ ...s.input, paddingRight: 44 }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword(v => !v)} style={s.eyeBtn}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <div style={s.passwordStrength}>
                {password.length === 0 ? '' :
                  password.length < 8 ? '⚠️ Too short' :
                  password.length < 12 ? '🟡 OK' : '🟢 Strong'}
              </div>
            </div>

            <div style={s.consentBox}>
              <span style={{ fontSize: 12, color: '#888780', lineHeight: 1.5 }}>
                By creating an account you agree to our{' '}
                <span style={{ color: '#378ADD' }}>Privacy Policy</span> and{' '}
                <span style={{ color: '#378ADD' }}>Terms of Use</span>.{' '}
                Your data is protected under GDPR and Quebec Law 25.
              </span>
            </div>

            <button style={s.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account →'}
            </button>

            <p style={s.switchText}>
              Already have an account?{' '}
              <button type="button" style={s.linkBtn} onClick={() => { setTab('login'); reset() }}>
                Sign in
              </button>
            </p>
          </form>
        )}

        {/* MAGIC LINK TAB */}
        {tab === 'magic' && (
          <form onSubmit={handleMagicLink}>
            <p style={s.magicDesc}>
              Enter your email and we'll send you a one-click sign-in link. No password needed.
            </p>
            <div style={s.formRow}>
              <label style={s.label}>Email address</label>
              <input style={s.input} type="email" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <button style={s.btnPrimary} type="submit" disabled={loading}>
              {loading ? 'Sending...' : '✉️ Send magic link'}
            </button>
            <p style={s.switchText}>
              Remember your password?{' '}
              <button type="button" style={s.linkBtn} onClick={() => { setTab('login'); reset() }}>
                Sign in with password
              </button>
            </p>
          </form>
        )}

        <p style={s.privacy}>🔒 GDPR + Quebec Law 25 compliant · Your data is encrypted</p>
      </div>
    </div>
  )
}

const s = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f6', padding: '1rem' },
  card: { background: '#fff', borderRadius: 16, border: '1px solid #e8e8e4', padding: '2rem', width: '100%', maxWidth: 400 },
  logoWrap: { textAlign: 'center', marginBottom: '1.5rem' },
  logoIcon: { fontSize: 40, marginBottom: 6 },
  title: { fontSize: 22, fontWeight: 600, color: '#2c2c2a', marginBottom: 2 },
  sub: { fontSize: 12, color: '#888780' },
  tabs: { display: 'flex', gap: 4, marginBottom: '1.25rem', background: '#f0f0ee', borderRadius: 10, padding: 4 },
  tabBtn: { flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#888780', fontWeight: 400 },
  tabActive: { background: '#fff', color: '#2c2c2a', fontWeight: 500, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  formRow: { marginBottom: 12 },
  label: { fontSize: 12, color: '#888780', display: 'block', marginBottom: 4 },
  input: { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 13, boxSizing: 'border-box', color: '#2c2c2a', background: '#fff' },
  passwordWrap: { position: 'relative' },
  eyeBtn: { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0 },
  passwordStrength: { fontSize: 11, marginTop: 4, color: '#888780' },
  rememberRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  checkLabel: { display: 'flex', alignItems: 'center', fontSize: 12, color: '#888780', cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#378ADD', padding: 0 },
  btnPrimary: { width: '100%', padding: 12, borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginBottom: 12 },
  switchText: { textAlign: 'center', fontSize: 12, color: '#888780' },
  magicDesc: { fontSize: 13, color: '#888780', lineHeight: 1.6, marginBottom: 14 },
  consentBox: { background: '#f8f8f6', borderRadius: 8, padding: '8px 10px', marginBottom: 12 },
  successBox: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: '#EAF3DE', border: '1px solid #97C459', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#27500A', lineHeight: 1.5 },
  errorBox: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: '#FCEBEB', border: '1px solid #F09595', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#A32D2D', lineHeight: 1.5 },
  privacy: { textAlign: 'center', fontSize: 10, color: '#b0b0ac', marginTop: 16, lineHeight: 1.5 }
}
