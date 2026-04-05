import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.icon}>🏠</div>
        <h1 style={styles.title}>Family App</h1>
        <p style={styles.sub}>Quebec, Canada</p>

        {!sent ? (
          <form onSubmit={handleLogin}>
            <p style={styles.desc}>Enter your email and we'll send you a magic sign-in link. No password needed.</p>
            <input
              style={styles.input}
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send magic link ✉️'}
            </button>
          </form>
        ) : (
          <div style={styles.sentBox}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
            <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Check your email</h2>
            <p style={{ fontSize: 13, color: '#888780', lineHeight: 1.6 }}>
              We sent a magic link to <strong>{email}</strong>.<br />
              Tap the link in the email to sign in.
            </p>
            <button style={{ ...styles.btn, marginTop: 16, background: 'none', color: '#378ADD', border: '1px solid #378ADD' }}
              onClick={() => setSent(false)}>
              Use a different email
            </button>
          </div>
        )}

        <p style={styles.privacy}>
          Your data is protected under GDPR and Quebec Law 25.
        </p>
      </div>
    </div>
  )
}

const styles = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f8f6', padding: '1rem' },
  card: { background: '#fff', borderRadius: 16, border: '1px solid #e8e8e4', padding: '2.5rem', width: '100%', maxWidth: 400, textAlign: 'center' },
  icon: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 600, color: '#2c2c2a', marginBottom: 4 },
  sub: { fontSize: 13, color: '#888780', marginBottom: 24 },
  desc: { fontSize: 13, color: '#888780', lineHeight: 1.6, marginBottom: 16, textAlign: 'left' },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 14, marginBottom: 10, boxSizing: 'border-box', color: '#2c2c2a' },
  btn: { width: '100%', padding: 12, borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  error: { fontSize: 12, color: '#E24B4A', marginBottom: 8, textAlign: 'left' },
  sentBox: { padding: '1rem 0' },
  privacy: { fontSize: 11, color: '#b0b0ac', marginTop: 20, lineHeight: 1.5 }
}
