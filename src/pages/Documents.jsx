import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

const DOC_CATEGORIES = [
  { value: 'document',   label: 'Document',        icon: '📄' },
  { value: 'receipt',    label: 'Receipt',          icon: '🧾' },
  { value: 'invoice',    label: 'Invoice',          icon: '📋' },
  { value: 'contract',   label: 'Contract',         icon: '📝' },
  { value: 'property',   label: 'Home & Property',  icon: '🏠' },
  { value: 'vehicle',    label: 'Vehicle',          icon: '🚗' },
  { value: 'medical',    label: 'Medical',          icon: '🏥' },
  { value: 'insurance',  label: 'Insurance',        icon: '🛡️' },
  { value: 'photo',      label: 'Photo',            icon: '📸' },
  { value: 'other',      label: 'Other',            icon: '📦' },
]

const getCategoryMeta = (value) =>
  DOC_CATEGORIES.find(c => c.value === value) || DOC_CATEGORIES[0]

const formatBytes = (kb) => {
  if (!kb) return ''
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

const formatDate = (str) => {
  if (!str) return ''
  return new Date(str).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

const getMonthKey = (str) => (str || '').slice(0, 7)

const formatMonthLabel = (yyyymm) => {
  if (!yyyymm) return 'Unknown'
  const [y, m] = yyyymm.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleString('en-CA', { month: 'long', year: 'numeric' })
}

export default function Documents({ user, session }) {
  const [docs, setDocs] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('month') // 'user' | 'month' | 'type'
  const [userSortBy, setUserSortBy] = useState('date') // 'date' | 'type'
  const [monthSubUser, setMonthSubUser] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    display_name: '',
    doc_category: 'document',
    notes: '',
  })
  const [uploadFile, setUploadFile] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => { loadData() }, [session])

  async function loadData() {
    setLoading(true)
    const [{ data: d }, { data: m }] = await Promise.all([
      supabase.from('documents')
        .select('*')
        .eq('session_id', session.id)
        .order('created_at', { ascending: false }),
      supabase.from('session_members')
        .select('user_id, users!inner(id, display_name, email)')
        .eq('session_id', session.id)
    ])
    setDocs(d || [])
    setMembers(m || [])

    // Auto-expand current month
    const currentMonth = new Date().toISOString().slice(0, 7)
    setExpanded({ [currentMonth]: true })
    setLoading(false)
  }

  const getMemberName = (id) => {
    const m = members.find(m => m.user_id === id)
    return m?.users?.display_name || m?.users?.email || 'Unknown'
  }

  function toggleExpand(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Upload ──────────────────────────────────────────────
  function openUpload() {
    setUploadFile(null)
    setUploadForm({ display_name: '', doc_category: 'document', notes: '' })
    setShowUpload(true)
  }

  async function handleUpload() {
    if (!uploadFile) { alert('Please select a file'); return }
    setUploading(true)
    try {
      const ext = uploadFile.name.split('.').pop()
      const path = `${session.id}/${Date.now()}_${uploadFile.name}`
      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(path, uploadFile, { upsert: false })

      if (storageError) throw storageError

      const { error: dbError } = await supabase.from('documents').insert({
        session_id: session.id,
        file_name: uploadFile.name,
        file_path: path,
        file_type: uploadFile.type || ext,
        file_size_kb: Math.round(uploadFile.size / 1024),
        source: 'document',
        uploaded_by: user.id,
        doc_category: uploadForm.doc_category,
        display_name: uploadForm.display_name || uploadFile.name,
        notes: uploadForm.notes || null,
      })

      if (dbError) throw dbError
      setShowUpload(false)
      await loadData()
    } catch (err) {
      alert('Upload failed: ' + err.message)
    }
    setUploading(false)
  }

  async function openDoc(doc) {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function deleteDoc(doc) {
    if (!confirm(`Delete "${doc.display_name || doc.file_name}"?`)) return
    await supabase.storage.from('documents').remove([doc.file_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    setSelectedDoc(null)
    await loadData()
  }

  // ── Grouping helpers ────────────────────────────────────
  function groupBy(arr, keyFn) {
    const map = {}
    arr.forEach(item => {
      const k = keyFn(item)
      if (!map[k]) map[k] = []
      map[k].push(item)
    })
    return map
  }

  const sortedDocs = (arr, by) => {
    if (by === 'type') return [...arr].sort((a, b) => (a.doc_category || '').localeCompare(b.doc_category || ''))
    return [...arr].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  // ── Render a single doc row ─────────────────────────────
  function DocRow({ doc }) {
    const cat = getCategoryMeta(doc.doc_category)
    return (
      <div
        onClick={() => setSelectedDoc(doc)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: '#fff',
          borderTop: '1px solid #f0f0ee', cursor: 'pointer'
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#f8f8f6'}
        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
      >
        <span style={{ fontSize: 20, flexShrink: 0 }}>{cat.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#2c2c2a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.display_name || doc.file_name}
          </div>
          <div style={{ fontSize: 11, color: '#888780', marginTop: 1 }}>
            {cat.label} · {formatDate(doc.created_at)} · {getMemberName(doc.uploaded_by)}
            {doc.file_size_kb ? ` · ${formatBytes(doc.file_size_kb)}` : ''}
          </div>
        </div>
        <span style={{ fontSize: 11, color: '#b0b0ac', flexShrink: 0 }}>›</span>
      </div>
    )
  }

  // ── Section header (collapsible) ────────────────────────
  function SectionHeader({ label, count, groupKey, isFirst }) {
    const isOpen = expanded[groupKey] ?? false
    return (
      <button
        onClick={() => toggleExpand(groupKey)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#f4f4f2', border: '1px solid #e8e8e4',
          borderRadius: isFirst ? '10px 10px 0 0' : 0,
          padding: '9px 14px', cursor: 'pointer', textAlign: 'left',
          borderTop: isFirst ? '1px solid #e8e8e4' : 'none'
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#2c2c2a' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#888780' }}>{count} file{count !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 11, color: '#888780', fontWeight: 700 }}>{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>
    )
  }

  // ── View renderers ──────────────────────────────────────
  function renderByUser() {
    const byUser = groupBy(docs, d => d.uploaded_by)
    return Object.entries(byUser).map(([userId, userDocs], idx) => {
      const isOpen = expanded[`user_${userId}`] ?? false
      const sorted = sortedDocs(userDocs, userSortBy)
      return (
        <div key={userId} style={{ marginBottom: 10 }}>
          <SectionHeader
            label={getMemberName(userId)}
            count={userDocs.length}
            groupKey={`user_${userId}`}
            isFirst={true}
          />
          {isOpen && (
            <div style={{ border: '1px solid #e8e8e4', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {sorted.map(doc => <DocRow key={doc.id} doc={doc} />)}
            </div>
          )}
        </div>
      )
    })
  }

  function renderByMonth() {
    const byMonth = groupBy(docs, d => getMonthKey(d.created_at))
    const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0]))
    return months.map(([month, monthDocs]) => {
      const isOpen = expanded[month] ?? false
      return (
        <div key={month} style={{ marginBottom: 10 }}>
          <SectionHeader
            label={formatMonthLabel(month)}
            count={monthDocs.length}
            groupKey={month}
            isFirst={true}
          />
          {isOpen && (
            <div style={{ border: '1px solid #e8e8e4', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {monthSubUser
                ? (() => {
                    const byUser = groupBy(monthDocs, d => d.uploaded_by)
                    return Object.entries(byUser).map(([userId, userDocs]) => (
                      <div key={userId}>
                        <div style={{ padding: '6px 14px', background: '#fafaf8', borderTop: '1px solid #f0f0ee', fontSize: 11, fontWeight: 600, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {getMemberName(userId)}
                        </div>
                        {sortedDocs(userDocs, 'date').map(doc => <DocRow key={doc.id} doc={doc} />)}
                      </div>
                    ))
                  })()
                : sortedDocs(monthDocs, 'date').map(doc => <DocRow key={doc.id} doc={doc} />)
              }
            </div>
          )}
        </div>
      )
    })
  }

  function renderByType() {
    const byType = groupBy(docs, d => d.doc_category || 'document')
    const types = Object.entries(byType).sort((a, b) => a[0].localeCompare(b[0]))
    return types.map(([type, typeDocs]) => {
      const cat = getCategoryMeta(type)
      const isOpen = expanded[`type_${type}`] ?? false
      const sorted = sortedDocs(typeDocs, 'date')
      return (
        <div key={type} style={{ marginBottom: 10 }}>
          <button
            onClick={() => toggleExpand(`type_${type}`)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#f4f4f2', border: '1px solid #e8e8e4',
              borderRadius: isOpen ? '10px 10px 0 0' : 10,
              padding: '9px 14px', cursor: 'pointer', textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{cat.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2c2c2a' }}>{cat.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#888780' }}>{typeDocs.length} file{typeDocs.length !== 1 ? 's' : ''}</span>
              <span style={{ fontSize: 11, color: '#888780', fontWeight: 700 }}>{isOpen ? '▲' : '▼'}</span>
            </div>
          </button>
          {isOpen && (
            <div style={{ border: '1px solid #e8e8e4', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {sorted.map(doc => <DocRow key={doc.id} doc={doc} />)}
            </div>
          )}
        </div>
      )
    })
  }

  if (loading) return <div style={{ padding: '2rem', color: '#888780', textAlign: 'center' }}>Loading...</div>

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          ['Total files', docs.length, '#2c2c2a'],
          ['This month', docs.filter(d => getMonthKey(d.created_at) === new Date().toISOString().slice(0, 7)).length, '#378ADD'],
          ['By you', docs.filter(d => d.uploaded_by === user.id).length, '#27500A'],
        ].map(([l, v, c]) => (
          <div key={l} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e4', padding: 12 }}>
            <div style={{ fontSize: 11, color: '#888780', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Documents</span>
        <button onClick={openUpload} style={primaryBtnStyle}>+ Upload</button>
      </div>

      {/* View mode selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: '#f4f4f2', borderRadius: 10, padding: 4 }}>
        {[['month', '📅 By Month'], ['user', '👤 By User'], ['type', '🗂️ By Type']].map(([mode, label]) => (
          <button key={mode} onClick={() => setViewMode(mode)}
            style={{
              flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s',
              background: viewMode === mode ? '#fff' : 'transparent',
              color: viewMode === mode ? '#2c2c2a' : '#888780',
              boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Sub-options */}
      {viewMode === 'user' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#888780' }}>Sort by:</span>
          {[['date', 'Date'], ['type', 'Type']].map(([val, lbl]) => (
            <button key={val} onClick={() => setUserSortBy(val)}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid', fontSize: 12, cursor: 'pointer',
                borderColor: userSortBy === val ? '#378ADD' : '#d0d0cc',
                background: userSortBy === val ? '#EBF4FF' : '#fff',
                color: userSortBy === val ? '#378ADD' : '#888780', fontWeight: userSortBy === val ? 500 : 400 }}>
              {lbl}
            </button>
          ))}
        </div>
      )}

      {viewMode === 'month' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <button onClick={() => setMonthSubUser(v => !v)}
            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid', fontSize: 12, cursor: 'pointer',
              borderColor: monthSubUser ? '#378ADD' : '#d0d0cc',
              background: monthSubUser ? '#EBF4FF' : '#fff',
              color: monthSubUser ? '#378ADD' : '#888780', fontWeight: monthSubUser ? 500 : 400 }}>
            {monthSubUser ? '✓ ' : ''}Group by user
          </button>
        </div>
      )}

      {/* Doc list */}
      {docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888780', fontSize: 13 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
          No documents yet. Upload your first one!
        </div>
      ) : (
        <>
          {viewMode === 'user' && renderByUser()}
          {viewMode === 'month' && renderByMonth()}
          {viewMode === 'type' && renderByType()}
        </>
      )}

      {/* ── Detail modal ── */}
      {selectedDoc && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setSelectedDoc(null) }}>
          <div style={modalStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28 }}>{getCategoryMeta(selectedDoc.doc_category).icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#2c2c2a' }}>{selectedDoc.display_name || selectedDoc.file_name}</div>
                  <div style={{ fontSize: 11, color: '#888780' }}>{getCategoryMeta(selectedDoc.doc_category).label}</div>
                </div>
              </div>
              <button onClick={() => setSelectedDoc(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888780' }}>✕</button>
            </div>

            {[
              ['File name', selectedDoc.file_name],
              ['Uploaded by', getMemberName(selectedDoc.uploaded_by)],
              ['Date', formatDate(selectedDoc.created_at)],
              ['Size', formatBytes(selectedDoc.file_size_kb) || '—'],
              ['Source', selectedDoc.source || '—'],
              ['Notes', selectedDoc.notes || '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0f0ee', fontSize: 13 }}>
                <span style={{ color: '#888780' }}>{label}</span>
                <span style={{ color: '#2c2c2a', maxWidth: '60%', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => openDoc(selectedDoc)}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                📂 Open file
              </button>
              <button onClick={() => deleteDoc(selectedDoc)}
                style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer', fontSize: 13 }}>
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload modal ── */}
      {showUpload && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setShowUpload(false) }}>
          <div style={{ ...modalStyle, maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#2c2c2a', margin: 0 }}>Upload document</h3>
              <button onClick={() => setShowUpload(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888780' }}>✕</button>
            </div>

            {/* File picker */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed #d0d0cc', borderRadius: 10, padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: 14, background: uploadFile ? '#EAF3DE' : '#f8f8f6' }}>
              {uploadFile ? (
                <>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>✅</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#2c2c2a' }}>{uploadFile.name}</div>
                  <div style={{ fontSize: 11, color: '#888780' }}>{formatBytes(Math.round(uploadFile.size / 1024))}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#2c2c2a' }}>Tap to choose file</div>
                  <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>PDF, image, or any file type</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" style={{ display: 'none' }}
              onChange={e => setUploadFile(e.target.files?.[0] || null)} />

            {/* Category */}
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Category</label>
              <select value={uploadForm.doc_category}
                onChange={e => setUploadForm(p => ({ ...p, doc_category: e.target.value }))}
                style={inputStyle}>
                {DOC_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>

            {/* Display name */}
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Display name <span style={{ color: '#b0b0ac' }}>(optional)</span></label>
              <input type="text" value={uploadForm.display_name} placeholder={uploadFile?.name || 'e.g. Home insurance 2026'}
                onChange={e => setUploadForm(p => ({ ...p, display_name: e.target.value }))}
                style={inputStyle} />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Notes <span style={{ color: '#b0b0ac' }}>(optional)</span></label>
              <textarea value={uploadForm.notes} placeholder="Any notes about this document..."
                onChange={e => setUploadForm(p => ({ ...p, notes: e.target.value }))}
                rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUpload(false)}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #d0d0cc', background: 'none', cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={handleUpload} disabled={uploading || !uploadFile}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: !uploadFile ? '#b0b0ac' : '#378ADD', color: '#fff', cursor: !uploadFile || uploading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}>
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const primaryBtnStyle = { padding: '7px 14px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }
const modalStyle = { background: '#fff', borderRadius: 14, border: '1px solid #e8e8e4', padding: '1.5rem', width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto' }
const labelStyle = { fontSize: 12, color: '#888780', display: 'block', marginBottom: 4 }
const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 13, boxSizing: 'border-box', color: '#2c2c2a', background: '#fff' }
