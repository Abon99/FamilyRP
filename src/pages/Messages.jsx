import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

const SYSTEM_PREFIX = '__system__:'

function isSystemMessage(content) {
  return content?.startsWith(SYSTEM_PREFIX)
}

function getSystemText(content) {
  return content?.slice(SYSTEM_PREFIX.length) || ''
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return isMobile
}

export default function Messages({ user, session }) {
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [msgDocs, setMsgDocs] = useState({})
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [attachFile, setAttachFile] = useState(null)
  const [attachPreview, setAttachPreview] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [activeMenu, setActiveMenu] = useState(null)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const isMobile = useIsMobile()

  useEffect(() => { loadData() }, [session])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    function handleClick() { setActiveMenu(null) }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: m }, { data: mb }, { data: d }] = await Promise.all([
      supabase.from('messages').select('*')
        .eq('session_id', session.id)
        .eq('board', 'general')
        .order('created_at', { ascending: true }),
      supabase.from('session_members')
        .select('user_id, users(id, display_name, email)')
        .eq('session_id', session.id),
      supabase.from('documents')
        .select('*')
        .eq('session_id', session.id)
        .eq('source', 'message')
        .not('message_id', 'is', null)
    ])
    setMessages(m || [])
    setMembers(mb || [])
    const grouped = {}
    ;(d || []).forEach(doc => {
      if (!grouped[doc.message_id]) grouped[doc.message_id] = []
      grouped[doc.message_id].push(doc)
    })
    setMsgDocs(grouped)
    setLoading(false)
  }

  function handleAttachSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachFile(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = ev => setAttachPreview(ev.target.result)
      reader.readAsDataURL(file)
    } else {
      setAttachPreview(null)
    }
    e.target.value = ''
  }

  function clearAttach() {
    setAttachFile(null)
    setAttachPreview(null)
  }

  async function sendMessage() {
    if (!text.trim() && !attachFile) return
    setSending(true)
    try {
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .insert({
          session_id: session.id,
          board: 'general',
          author_id: user.id,
          content: text.trim() || null
        })
        .select()
        .single()

      if (msgError) throw msgError

      if (attachFile) {
        const path = `${session.id}/${Date.now()}_${attachFile.name}`
        const { error: storageError } = await supabase.storage
          .from('documents')
          .upload(path, attachFile, { upsert: false })
        if (storageError) throw storageError

        const isImage = attachFile.type.startsWith('image/')
        const { error: docError } = await supabase.from('documents').insert({
          session_id: session.id,
          file_name: attachFile.name,
          file_path: path,
          file_type: attachFile.type || 'application/octet-stream',
          file_size_kb: Math.round(attachFile.size / 1024),
          source: 'message',
          source_id: msgData.id,
          message_id: msgData.id,
          uploaded_by: user.id,
          doc_category: isImage ? 'photo' : 'document',
          display_name: attachFile.name,
        })
        if (docError) throw docError
      }

      setText('')
      clearAttach()
      await loadData()
    } catch (err) {
      alert('Send failed: ' + err.message)
    }
    setSending(false)
  }

  async function confirmAndDeleteDoc() {
    const doc = confirmDelete.payload
    try {
      await supabase.storage.from('documents').remove([doc.file_path])
      await supabase.from('documents').delete().eq('id', doc.id)
      const userName = getName(user.id)
      await supabase.from('messages').insert({
        session_id: session.id,
        board: 'general',
        author_id: user.id,
        content: `${SYSTEM_PREFIX}📄 "${doc.display_name || doc.file_name}" was deleted by ${userName}`
      })
      setConfirmDelete(null)
      await loadData()
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  async function confirmAndDeleteMessage() {
    const msg = confirmDelete.payload
    const docs = msgDocs[msg.id] || []
    try {
      for (const doc of docs) {
        await supabase.storage.from('documents').remove([doc.file_path])
        await supabase.from('documents').delete().eq('id', doc.id)
      }
      await supabase.from('messages').delete().eq('id', msg.id)
      setConfirmDelete(null)
      await loadData()
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  async function openDoc(doc) {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const getMember = (id) => members.find(m => m.user_id === id)
  const getName = (id) => getMember(id)?.users?.display_name || getMember(id)?.users?.email?.split('@')[0] || 'Unknown'
  const getInitials = (id) => getName(id).slice(0, 2).toUpperCase()

  const COLORS = ['#E6F1FB', '#E1F5EE', '#FAECE7', '#FBEAF0', '#EEEDFE']
  const TEXT_COLORS = ['#0C447C', '#085041', '#4A1B0C', '#4B1528', '#26215C']
  const memberIdx = (id) => members.findIndex(m => m.user_id === id) % COLORS.length
  const isImageDoc = (doc) => doc.file_type?.startsWith('image/')

  // On mobile the bottom tab bar is 60px — subtract that from height
  const containerHeight = isMobile
    ? 'calc(100vh - 140px - 60px)'
    : 'calc(100vh - 140px)'

  if (loading) return <div style={{ padding: '2rem', color: '#888780', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: containerHeight }}>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>General board</div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#888780', fontSize: 13 }}>
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map(m => {
            if (isSystemMessage(m.content)) {
              return (
                <div key={m.id} style={{ textAlign: 'center', margin: '8px 0' }}>
                  <span style={{ fontSize: 11, color: '#b0b0ac', fontStyle: 'italic', background: '#f4f4f2', borderRadius: 20, padding: '3px 12px', display: 'inline-block' }}>
                    {getSystemText(m.content)}
                  </span>
                </div>
              )
            }

            const isMe = m.author_id === user.id
            const idx = memberIdx(m.author_id)
            const docs = msgDocs[m.id] || []
            const isMenuOpen = activeMenu === m.id

            return (
              <div key={m.id} style={{ display: 'flex', gap: 8, marginBottom: 12, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                {!isMe && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: COLORS[idx], color: TEXT_COLORS[idx], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, flexShrink: 0, marginTop: 2 }}>
                    {getInitials(m.author_id)}
                  </div>
                )}

                <div style={{ maxWidth: '75%', position: 'relative' }}>
                  {!isMe && <div style={{ fontSize: 11, color: '#888780', marginBottom: 2 }}>{getName(m.author_id)}</div>}

                  {m.content && (
                    <div style={{ padding: '8px 12px', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: isMe ? '#378ADD' : '#fff', color: isMe ? '#fff' : '#2c2c2a', fontSize: 13, border: isMe ? 'none' : '1px solid #e8e8e4', lineHeight: 1.5, marginBottom: docs.length ? 4 : 0 }}>
                      {m.content}
                    </div>
                  )}

                  {docs.map(doc => (
                    <div key={doc.id} style={{ marginTop: 4, position: 'relative' }}>
                      <div onClick={() => openDoc(doc)}
                        style={{ cursor: 'pointer', borderRadius: 10, overflow: 'hidden', border: '1px solid #e8e8e4', maxWidth: 220 }}>
                        {isImageDoc(doc) ? (
                          <ImageThumb doc={doc} />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: isMe ? '#2a6aad' : '#f8f8f6' }}>
                            <span style={{ fontSize: 20 }}>📄</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: isMe ? '#fff' : '#2c2c2a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {doc.display_name || doc.file_name}
                              </div>
                              <div style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.7)' : '#888780' }}>
                                {doc.file_size_kb ? `${doc.file_size_kb < 1024 ? doc.file_size_kb + ' KB' : (doc.file_size_kb / 1024).toFixed(1) + ' MB'}` : 'File'} · Tap to open
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      {doc.uploaded_by === user.id && (
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDelete({ type: 'doc', payload: doc }) }}
                          style={{ position: 'absolute', top: 4, right: isMe ? 'auto' : 4, left: isMe ? 4 : 'auto', background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 10, padding: '2px 6px', cursor: 'pointer' }}>
                          🗑
                        </button>
                      )}
                    </div>
                  ))}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{ fontSize: 10, color: '#b0b0ac' }}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {isMe && (
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setActiveMenu(isMenuOpen ? null : m.id) }}
                          style={{ background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', color: '#b0b0ac', padding: '0 2px', lineHeight: 1 }}>
                          ⋯
                        </button>
                        {isMenuOpen && (
                          <div onClick={e => e.stopPropagation()}
                            style={{ position: 'absolute', bottom: '100%', right: 0, background: '#fff', border: '1px solid #e8e8e4', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', overflow: 'hidden', minWidth: 130, zIndex: 50 }}>
                            <button
                              onClick={() => { setActiveMenu(null); setConfirmDelete({ type: 'message', payload: m }) }}
                              style={{ width: '100%', padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#A32D2D', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                              🗑 Delete message
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef}></div>
      </div>

      {/* Attach preview bar */}
      {attachFile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f4f4f2', borderRadius: 10, padding: '8px 12px', marginBottom: 8, border: '1px solid #e8e8e4' }}>
          {attachPreview
            ? <img src={attachPreview} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            : <span style={{ fontSize: 24, flexShrink: 0 }}>📄</span>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#2c2c2a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachFile.name}</div>
            <div style={{ fontSize: 11, color: '#888780' }}>{Math.round(attachFile.size / 1024)} KB</div>
          </div>
          <button onClick={clearAttach}
            style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#888780', flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 8, background: '#fff', border: '1px solid #e8e8e4', borderRadius: 12, padding: '8px 12px', alignItems: 'flex-end' }}>
        <button onClick={() => fileRef.current?.click()}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888780', padding: '2px 0', flexShrink: 0, lineHeight: 1 }}>
          📎
        </button>
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleAttachSelect} />

        <textarea value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Write a message..." rows={1}
          style={{ flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: 13, fontFamily: 'inherit', color: '#2c2c2a', background: 'none' }} />

        <button onClick={sendMessage} disabled={sending || (!text.trim() && !attachFile)}
          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: (text.trim() || attachFile) ? '#378ADD' : '#f0f0ee', color: (text.trim() || attachFile) ? '#fff' : '#b0b0ac', cursor: (text.trim() || attachFile) ? 'pointer' : 'default', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>
          {sending ? '...' : 'Send'}
        </button>
      </div>

      {/* Confirm delete popup */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', width: '100%', maxWidth: 360, border: '1px solid #e8e8e4' }}>
            <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2c2c2a', textAlign: 'center', marginBottom: 8 }}>
              {confirmDelete.type === 'message' ? 'Delete message?' : 'Delete document?'}
            </div>
            <div style={{ fontSize: 13, color: '#555', textAlign: 'center', marginBottom: 6, lineHeight: 1.5 }}>
              {confirmDelete.type === 'message'
                ? 'This message will be deleted.'
                : 'The document will be removed from all locations. This action is irreversible. Go ahead?'
              }
            </div>
            {confirmDelete.type === 'doc' && (
              <div style={{ fontSize: 12, color: '#888780', textAlign: 'center', marginBottom: 20, fontStyle: 'italic' }}>
                "{confirmDelete.payload.display_name || confirmDelete.payload.file_name}"
              </div>
            )}
            {confirmDelete.type === 'message' && (
              <div style={{ fontSize: 12, color: '#888780', textAlign: 'center', marginBottom: 20, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                "{confirmDelete.payload.content?.slice(0, 60) || 'Message with attachment'}"
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #d0d0cc', background: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#2c2c2a' }}>
                No
              </button>
              <button onClick={confirmDelete.type === 'message' ? confirmAndDeleteMessage : confirmAndDeleteDoc}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#A32D2D', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ImageThumb({ doc }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    supabase.storage.from('documents').createSignedUrl(doc.file_path, 300)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl) })
  }, [doc.file_path])
  if (!url) return (
    <div style={{ width: 180, height: 120, background: '#f0f0ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📸</div>
  )
  return <img src={url} alt={doc.file_name} style={{ width: '100%', maxWidth: 220, maxHeight: 180, objectFit: 'cover', display: 'block' }} />
}
