import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Messages({ user, session }) {
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { loadData() }, [session])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadData() {
    setLoading(true)
    const [{ data: m }, { data: mb }] = await Promise.all([
      supabase.from('messages').select('*').eq('session_id', session.id).eq('board', 'general').order('created_at', { ascending: true }),
      supabase.from('session_members').select('user_id, users(id, display_name, email)').eq('session_id', session.id)
    ])
    setMessages(m || [])
    setMembers(mb || [])
    setLoading(false)
  }

  async function sendMessage() {
    if (!text.trim()) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      session_id: session.id, board: 'general',
      author_id: user.id, content: text.trim()
    })
    if (!error) { setText(''); await loadData() }
    setSending(false)
  }

  const getMember = (id) => members.find(m => m.user_id === id)
  const getName = (id) => getMember(id)?.users?.display_name || getMember(id)?.users?.email?.split('@')[0] || 'Unknown'
  const getInitials = (id) => getName(id).slice(0, 2).toUpperCase()

  const COLORS = ['#E6F1FB','#E1F5EE','#FAECE7','#FBEAF0','#EEEDFE']
  const TEXT_COLORS = ['#0C447C','#085041','#4A1B0C','#4B1528','#26215C']
  const memberIdx = (id) => members.findIndex(m => m.user_id === id) % COLORS.length

  if (loading) return <div style={{ padding: '2rem', color: '#888780', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>General board</div>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888780', fontSize: 13 }}>No messages yet. Start the conversation!</div>
        ) : (
          messages.map(m => {
            const isMe = m.author_id === user.id
            const idx = memberIdx(m.author_id)
            return (
              <div key={m.id} style={{ display: 'flex', gap: 8, marginBottom: 12, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                {!isMe && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: COLORS[idx], color: TEXT_COLORS[idx], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, flexShrink: 0, marginTop: 2 }}>
                    {getInitials(m.author_id)}
                  </div>
                )}
                <div style={{ maxWidth: '75%' }}>
                  {!isMe && <div style={{ fontSize: 11, color: '#888780', marginBottom: 2 }}>{getName(m.author_id)}</div>}
                  <div style={{ padding: '8px 12px', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: isMe ? '#378ADD' : '#fff', color: isMe ? '#fff' : '#2c2c2a', fontSize: 13, border: isMe ? 'none' : '1px solid #e8e8e4', lineHeight: 1.5 }}>
                    {m.content}
                  </div>
                  <div style={{ fontSize: 10, color: '#b0b0ac', marginTop: 2, textAlign: isMe ? 'right' : 'left' }}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef}></div>
      </div>

      <div style={{ display: 'flex', gap: 8, background: '#fff', border: '1px solid #e8e8e4', borderRadius: 12, padding: '8px 12px' }}>
        <textarea value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Write a message..." rows={1}
          style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: 13, fontFamily: 'inherit', color: '#2c2c2a', background: 'none' }} />
        <button onClick={sendMessage} disabled={sending || !text.trim()}
          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: text.trim() ? '#378ADD' : '#f0f0ee', color: text.trim() ? '#fff' : '#b0b0ac', cursor: text.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
          Send
        </button>
      </div>
    </div>
  )
}
