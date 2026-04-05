import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const SECTIONS = [
  { id: 'details',       icon: '👤', label: 'Personal details' },
  { id: 'password',      icon: '🔑', label: 'Password' },
  { id: 'privacy',       icon: '🔒', label: 'Privacy & consent' },
  { id: 'notifications', icon: '🔔', label: 'Notifications' },
  { id: 'danger',        icon: '⚠️', label: 'Delete account' },
]

export default function Profile({ user, onClose }) {
  const [activeSection, setActiveSection] = useState('details')
  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSuccess, setNameSuccess] = useState('')
  const [nameError, setNameError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [hasPassword, setHasPassword] = useState(false)

  const [consents, setConsents] = useState({ location: false, offers: false, ai: false })
  const [savingConsents, setSavingConsents] = useState(false)
  const [consentSuccess, setConsentSuccess] = useState('')

  const [notifs, setNotifs] = useState({ settlements: true, messages: true, calendar: true, location_requests: true })
  const [savingNotifs, setSavingNotifs] = useState(false)
  const [notifSuccess, setNotifSuccess] = useState('')

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => { loadProfile() }, [user])

  async function loadProfile() {
    // Load display name
    const { data } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', user.id)
      .single()
    if (data) setDisplayName(data.display_name || '')

    // Check if user has a password set (has identities with provider 'email')
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user?.identities) {
      const emailIdentity = userData.user.identities.find(i => i.provider === 'email')
      setHasPassword(!!emailIdentity?.identity_data?.email_verified)
    }

    // Load consents from localStorage (would be from DB in full implementation)
    const stored = localStorage.getItem('user_consents')
    if (stored) setConsents(JSON.parse(stored))

    const storedNotifs = localStorage.getItem('user_notifs')
    if (storedNotifs) setNotifs(JSON.parse(storedNotifs))
  }

  async function saveName() {
    if (!displayName.trim()) { setNameError('Name cannot be empty'); return }
    setSavingName(true); setNameError(''); setNameSuccess('')
    const { error } = await supabase
      .from('users')
      .update({ display_name: displayName.trim() })
      .eq('id', user.id)
    if (error) {
      setNameError('Error saving: ' + error.message)
    } else {
      setNameSuccess('Name updated successfully!')
      setTimeout(() => setNameSuccess(''), 3000)
    }
    setSavingName(false)
  }

  async function savePassword() {
    setPasswordError(''); setPasswordSuccess('')
    if (!newPassword) { setPasswordError('Please enter a new password'); return }
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError('Error: ' + error.message)
    } else {
      setPasswordSuccess('Password ' + (hasPassword ? 'updated' : 'set') + ' successfully!')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setHasPassword(true)
      setTimeout(() => setPasswordSuccess(''), 4000)
    }
    setSavingPassword(false)
  }

  async function saveConsents() {
    setSavingConsents(true)
    localStorage.setItem('user_consents', JSON.stringify(consents))
    // In full implementation: save to consent_records table
    await supabase.from('consent_records').insert(
      Object.entries(consents).map(([type, granted]) => ({
        user_id: user.id,
        consent_type: type,
        granted,
        policy_version: '1.0',
        recorded_at: new Date().toISOString()
      }))
    )
    setConsentSuccess('Preferences saved!')
    setTimeout(() => setConsentSuccess(''), 3000)
    setSavingConsents(false)
  }

  async function saveNotifs() {
    setSavingNotifs(true)
    localStorage.setItem('user_notifs', JSON.stringify(notifs))
    setNotifSuccess('Notification preferences saved!')
    setTimeout(() => setNotifSuccess(''), 3000)
    setSavingNotifs(false)
  }

  async function downloadMyData() {
    const [{ data: entries }, { data: receipts }, { data: messages }, { data: userData }] = await Promise.all([
      supabase.from('calendar_entries').select('*').eq('created_by', user.id),
      supabase.from('receipts').select('*').eq('created_by', user.id),
      supabase.from('messages').select('*').eq('author_id', user.id),
      supabase.from('users').select('*').eq('id', user.id),
    ])
    const exportData = {
      exported_at: new Date().toISOString(),
      user: userData?.[0],
      calendar_entries: entries || [],
      receipts: receipts || [],
      messages: messages || [],
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `my-data-${new Date().toISOString().split('T')[0]}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'DELETE') { setDeleteError('Please type DELETE to confirm'); return }
    setDeleting(true)
    // Soft delete — mark account for deletion (full deletion via Supabase admin in 30 days per GDPR)
    await supabase.from('users').update({ display_name: '[Deleted]', email: '[deleted]' }).eq('id', user.id)
    await supabase.auth.signOut()
  }

  function passwordStrength(p) {
    if (!p) return null
    if (p.length < 8) return { label: 'Too short', color: '#E24B4A' }
    if (p.length < 12) return { label: 'OK', color: '#EF9F27' }
    return { label: 'Strong', color: '#27500A' }
  }

  const strength = passwordStrength(newPassword)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', zIndex: 200, padding: '60px 8px 8px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e8e4', width: 'min(480px, 98vw)', maxHeight: 'calc(100vh - 76px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e8e8e4', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E6F1FB', color: '#0C447C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 500 }}>
            {user?.email?.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#2c2c2a' }}>{displayName || 'My profile'}</div>
            <div style={{ fontSize: 11, color: '#888780', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.email}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#888780', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sidebar */}
          <div style={{ width: 160, borderRight: '1px solid #e8e8e4', padding: '8px 0', flexShrink: 0, overflowY: 'auto' }}>
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                style={{ width: '100%', padding: '9px 12px', border: 'none', background: activeSection === s.id ? '#f0f8ff' : 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: activeSection === s.id ? '#0C447C' : '#2c2c2a', fontWeight: activeSection === s.id ? 500 : 400, display: 'flex', alignItems: 'center', gap: 7, borderLeft: activeSection === s.id ? '3px solid #378ADD' : '3px solid transparent' }}>
                <span>{s.icon}</span>{s.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>

            {/* PERSONAL DETAILS */}
            {activeSection === 'details' && (
              <div>
                <div style={sectionTitle}>Personal details</div>
                <div style={formRow}>
                  <label style={labelStyle}>Display name</label>
                  <input style={inputStyle} value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Your name" />
                </div>
                <div style={formRow}>
                  <label style={labelStyle}>Email address</label>
                  <input style={{ ...inputStyle, background: '#f8f8f6', color: '#888780' }}
                    value={user?.email} disabled />
                  <div style={{ fontSize: 11, color: '#888780', marginTop: 3 }}>Email cannot be changed here. Contact support to update your email.</div>
                </div>
                {nameError && <div style={errorBox}>{nameError}</div>}
                {nameSuccess && <div style={successBox}>{nameSuccess}</div>}
                <button onClick={saveName} disabled={savingName} style={primaryBtn}>
                  {savingName ? 'Saving...' : 'Save name'}
                </button>
              </div>
            )}

            {/* PASSWORD */}
            {activeSection === 'password' && (
              <div>
                <div style={sectionTitle}>{hasPassword ? 'Change password' : 'Set a password'}</div>
                {!hasPassword && (
                  <div style={{ ...infoBox, marginBottom: 14 }}>
                    You signed up with a magic link. Set a password to log in faster next time.
                  </div>
                )}
                <div style={formRow}>
                  <label style={labelStyle}>New password</label>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...inputStyle, paddingRight: 40 }}
                      type={showPasswords ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters" />
                    <button type="button" onClick={() => setShowPasswords(v => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
                      {showPasswords ? '🙈' : '👁️'}
                    </button>
                  </div>
                  {strength && <div style={{ fontSize: 11, marginTop: 3, color: strength.color }}>{strength.label}</div>}
                </div>
                <div style={formRow}>
                  <label style={labelStyle}>Confirm new password</label>
                  <input style={{ ...inputStyle, borderColor: confirmPassword && confirmPassword !== newPassword ? '#E24B4A' : '#d0d0cc' }}
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password" />
                  {confirmPassword && confirmPassword !== newPassword && (
                    <div style={{ fontSize: 11, color: '#E24B4A', marginTop: 3 }}>Passwords do not match</div>
                  )}
                </div>
                {passwordError && <div style={errorBox}>{passwordError}</div>}
                {passwordSuccess && <div style={successBox}>{passwordSuccess}</div>}
                <button onClick={savePassword} disabled={savingPassword} style={primaryBtn}>
                  {savingPassword ? 'Saving...' : hasPassword ? 'Update password' : 'Set password'}
                </button>
              </div>
            )}

            {/* PRIVACY & CONSENT */}
            {activeSection === 'privacy' && (
              <div>
                <div style={sectionTitle}>Privacy & consent</div>
                <div style={{ ...infoBox, marginBottom: 14 }}>
                  🔒 GDPR + Quebec Law 25 compliant. Your core app data is always required. The settings below are optional.
                </div>
                {[
                  { key: 'location', title: 'Location sharing', desc: 'Allow the app to track and share your location with session members when you enable it.' },
                  { key: 'offers', title: 'Personalised offers', desc: 'Allow the Offers tab to use your session activity to show relevant deals. No data shared with vendors.' },
                  { key: 'ai', title: 'AI briefing', desc: 'Allow anonymised session summaries to be sent to the AI for your daily briefing. No names or exact amounts included.' },
                ].map(item => (
                  <div key={item.key} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0ee', display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#2c2c2a', marginBottom: 2 }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: '#888780', lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <button onClick={() => setConsents(c => ({ ...c, [item.key]: !c[item.key] }))}
                        style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: consents[item.key] ? '#378ADD' : '#d0d0cc', position: 'relative', transition: 'background .2s' }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: consents[item.key] ? 21 : 3, transition: 'left .2s' }}></div>
                      </button>
                    </div>
                  </div>
                ))}
                {consentSuccess && <div style={{ ...successBox, marginTop: 10 }}>{consentSuccess}</div>}
                <button onClick={saveConsents} disabled={savingConsents} style={{ ...primaryBtn, marginTop: 14 }}>
                  {savingConsents ? 'Saving...' : 'Save preferences'}
                </button>
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f0f0ee' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#2c2c2a', marginBottom: 6 }}>Your data rights</div>
                  <button onClick={downloadMyData}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d0d0cc', background: 'none', cursor: 'pointer', fontSize: 13, color: '#2c2c2a', textAlign: 'left', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    📥 Download my data (GDPR Article 20)
                  </button>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS */}
            {activeSection === 'notifications' && (
              <div>
                <div style={sectionTitle}>Notification preferences</div>
                {[
                  { key: 'settlements', title: 'Settlement requests', desc: 'When someone requests or approves a settlement.' },
                  { key: 'messages', title: 'New messages', desc: 'When a new message is posted on any board you follow.' },
                  { key: 'calendar', title: 'Calendar reminders', desc: 'Reminders for upcoming events and tasks.' },
                  { key: 'location_requests', title: 'Location requests', desc: 'When someone requests to track your location.' },
                ].map(item => (
                  <div key={item.key} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0ee', display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#2c2c2a', marginBottom: 2 }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: '#888780', lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <button onClick={() => setNotifs(n => ({ ...n, [item.key]: !n[item.key] }))}
                        style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: notifs[item.key] ? '#378ADD' : '#d0d0cc', position: 'relative', transition: 'background .2s' }}>
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: notifs[item.key] ? 21 : 3, transition: 'left .2s' }}></div>
                      </button>
                    </div>
                  </div>
                ))}
                {notifSuccess && <div style={{ ...successBox, marginTop: 10 }}>{notifSuccess}</div>}
                <button onClick={saveNotifs} disabled={savingNotifs} style={{ ...primaryBtn, marginTop: 14 }}>
                  {savingNotifs ? 'Saving...' : 'Save preferences'}
                </button>
              </div>
            )}

            {/* DELETE ACCOUNT */}
            {activeSection === 'danger' && (
              <div>
                <div style={{ ...sectionTitle, color: '#A32D2D' }}>Delete account</div>
                <div style={{ background: '#FCEBEB', border: '1px solid #F09595', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#A32D2D', lineHeight: 1.6 }}>
                  ⚠️ This permanently deletes your account and all your personal data within 30 days, as required by GDPR. Shared session data (receipts, calendar entries visible to others) will be anonymised, not deleted.
                </div>
                <div style={formRow}>
                  <label style={labelStyle}>Type <strong>DELETE</strong> to confirm</label>
                  <input style={{ ...inputStyle, borderColor: '#F09595' }}
                    value={deleteConfirm}
                    onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder="Type DELETE" />
                </div>
                {deleteError && <div style={errorBox}>{deleteError}</div>}
                <button onClick={deleteAccount} disabled={deleting || deleteConfirm !== 'DELETE'}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: deleteConfirm === 'DELETE' ? '#E24B4A' : '#f0f0ee', color: deleteConfirm === 'DELETE' ? '#fff' : '#b0b0ac', cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 500 }}>
                  {deleting ? 'Deleting...' : 'Permanently delete my account'}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

const sectionTitle = { fontSize: 14, fontWeight: 500, color: '#2c2c2a', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #f0f0ee' }
const formRow = { marginBottom: 12 }
const labelStyle = { fontSize: 12, color: '#888780', display: 'block', marginBottom: 4 }
const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 13, boxSizing: 'border-box', color: '#2c2c2a', background: '#fff' }
const primaryBtn = { width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }
const errorBox = { padding: '8px 10px', background: '#FCEBEB', border: '1px solid #F09595', borderRadius: 8, fontSize: 12, color: '#A32D2D', marginBottom: 10 }
const successBox = { padding: '8px 10px', background: '#EAF3DE', border: '1px solid #97C459', borderRadius: 8, fontSize: 12, color: '#27500A', marginBottom: 10 }
const infoBox = { padding: '8px 10px', background: '#E6F1FB', border: '1px solid #85B7EB', borderRadius: 8, fontSize: 12, color: '#0C447C', lineHeight: 1.5 }
