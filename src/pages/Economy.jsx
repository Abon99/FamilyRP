import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Economy({ user, session }) {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState([])
  const [scanning, setScanning] = useState(false)
  const [scanPreview, setScanPreview] = useState(null)
  const [scanSuggestion, setScanSuggestion] = useState(null)
  const [scanStep, setScanStep] = useState('idle')
  const [selectedReceipt, setSelectedReceipt] = useState(null) // for detail view
  const [expandedMonths, setExpandedMonths] = useState({}) // { 'YYYY-MM': true/false }
  const cameraRef = useRef(null)

  const [form, setForm] = useState({
    store_name: '',
    total_amount: '',
    receipt_date: new Date().toISOString().split('T')[0],
    paid_by: user.id,
    owed_by: ''
  })

  useEffect(() => { loadData() }, [session])

  async function loadData() {
    setLoading(true)
    const [{ data: r }, { data: m }] = await Promise.all([
      supabase.from('receipts').select('*')
        .eq('session_id', session.id)
        .order('receipt_date', { ascending: false }),
      supabase.from('session_members')
        .select('user_id, role, users!inner(id, display_name, email)')
        .eq('session_id', session.id)
    ])
    setReceipts(r || [])
    setMembers(m || [])

    // Auto-expand current month
    const currentMonth = new Date().toISOString().slice(0, 7)
    setExpandedMonths({ [currentMonth]: true })
    setLoading(false)
  }

  // Group receipts by month (YYYY-MM)
  function groupByMonth(receipts) {
    const groups = {}
    receipts.forEach(r => {
      const month = (r.receipt_date || r.created_at?.slice(0, 10) || '').slice(0, 7)
      if (!groups[month]) groups[month] = []
      groups[month].push(r)
    })
    // Sort months descending
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }

  function formatMonthLabel(yyyymm) {
    if (!yyyymm) return 'Unknown'
    const [year, month] = yyyymm.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, 1)
    return date.toLocaleString('en-CA', { month: 'long', year: 'numeric' })
  }

  function toggleMonth(month) {
    setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }))
  }

  function openModal(prefill) {
    setScanPreview(null)
    setScanSuggestion(null)
    setScanStep('idle')
    setForm({
      store_name: prefill?.store_name || '',
      total_amount: prefill?.total_amount || '',
      receipt_date: prefill?.receipt_date || new Date().toISOString().split('T')[0],
      paid_by: user.id,
      owed_by: ''
    })
    setShowModal(true)
  }

  function triggerCamera() {
    cameraRef.current?.click()
  }

  async function handleImageCapture(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1]
      const preview = ev.target.result
      setScanPreview(preview)
      setScanStep('scanning')
      setScanning(true)
      try {
        const suggestion = await scanReceiptWithClaude(base64, file.type)
        setScanSuggestion(suggestion)
        setScanStep('reviewing')
        setForm(f => ({
          ...f,
          store_name: suggestion.store || '',
          total_amount: suggestion.amount || '',
          receipt_date: suggestion.date || f.receipt_date
        }))
      } catch (err) {
        console.error('Scan error:', err)
        setScanStep('error')
      }
      setScanning(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function scanReceiptWithClaude(base64, mediaType) {
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch(
      'https://vuuvmublqrwfsxmiowyn.supabase.co/functions/v1/scan-receipt',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ image: base64, mediaType: mediaType || 'image/jpeg' })
      }
    )
    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.error || 'Scan failed')
    }
    return await response.json()
  }

  async function saveReceipt() {
    if (!form.store_name.trim() || !form.total_amount) {
      alert('Please fill in store name and amount')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('receipts').insert({
      session_id: session.id,
      store_name: form.store_name,
      total_amount: parseFloat(form.total_amount),
      receipt_date: form.receipt_date,
      paid_by: form.paid_by,
      owed_by: form.owed_by || null,
      settled: false,
      created_by: user.id
    })
    if (error) alert('Error: ' + error.message)
    else {
      setShowModal(false)
      await loadData()
    }
    setSaving(false)
  }

  async function toggleSettled(id, current) {
    await supabase.from('receipts')
      .update({ settled: !current, settled_at: !current ? new Date().toISOString() : null })
      .eq('id', id)
    // Update local state for detail view
    setSelectedReceipt(prev => prev?.id === id ? { ...prev, settled: !current } : prev)
    await loadData()
  }

  async function deleteReceipt(id) {
    if (!confirm('Delete this receipt?')) return
    await supabase.from('receipts').delete().eq('id', id)
    setSelectedReceipt(null)
    await loadData()
  }

  const getMemberName = (id) => {
    const m = members.find(m => m.user_id === id)
    return m?.users?.display_name || m?.users?.email || 'Unknown'
  }

  const open = receipts.filter(r => !r.settled)
  const settled = receipts.filter(r => r.settled)
  const totalOpen = open.reduce((s, r) => s + Number(r.total_amount), 0)
  const monthGroups = groupByMonth(receipts)

  if (loading) return <div style={{ padding: '2rem', color: '#888780', textAlign: 'center' }}>Loading...</div>

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          ['Open receipts', open.length, '#2c2c2a'],
          ['Outstanding', '$' + totalOpen.toFixed(2), '#D85A30'],
          ['Settled', settled.length, '#27500A']
        ].map(([l, v, c]) => (
          <div key={l} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e4', padding: 12 }}>
            <div style={{ fontSize: 11, color: '#888780', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Receipts</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => openModal()} style={outlineBtnStyle}>
            + Manual entry
          </button>
          <button onClick={() => { openModal(); setTimeout(triggerCamera, 100) }} style={primaryBtnStyle}>
            📷 Scan receipt
          </button>
        </div>
      </div>

      {/* Receipt list grouped by month */}
      {receipts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888780', fontSize: 13 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🧾</div>
          No receipts yet. Scan or add your first one!
        </div>
      ) : (
        monthGroups.map(([month, monthReceipts]) => {
          const isExpanded = expandedMonths[month] ?? false
          const monthTotal = monthReceipts.reduce((s, r) => s + Number(r.total_amount), 0)
          const monthUnsettled = monthReceipts.filter(r => !r.settled).reduce((s, r) => s + Number(r.total_amount), 0)
          const allSettled = monthUnsettled === 0
          const accentColor = allSettled ? '#27500A' : '#D85A30'
          const accentBg = allSettled ? '#EAF3DE' : '#FFF3E0'
          const accentBorder = allSettled ? '#97C459' : '#EF9F27'

          return (
            <div key={month} style={{ marginBottom: 10 }}>
              {/* Month header — always visible */}
              <button
                onClick={() => toggleMonth(month)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: isExpanded ? '10px 10px 0 0' : 10,
                  padding: '10px 14px', cursor: 'pointer', textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: accentColor }}>
                    {formatMonthLabel(month)}
                  </span>
                  <span style={{ fontSize: 11, color: '#888780' }}>
                    {monthReceipts.length} receipt{monthReceipts.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2c2a' }}>${monthTotal.toFixed(2)}</div>
                    {!allSettled && (
                      <div style={{ fontSize: 10, color: '#D85A30' }}>${monthUnsettled.toFixed(2)} unsettled</div>
                    )}
                    {allSettled && (
                      <div style={{ fontSize: 10, color: '#27500A' }}>All settled ✓</div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: accentColor, fontWeight: 700 }}>
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>
              </button>

              {/* Month receipts */}
              {isExpanded && (
                <div style={{ border: `1px solid ${accentBorder}`, borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                  {monthReceipts.map((r, idx) => (
                    <div
                      key={r.id}
                      onClick={() => setSelectedReceipt(r)}
                      style={{
                        background: '#fff', padding: '12px 16px',
                        borderTop: idx > 0 ? '1px solid #f0f0ee' : 'none',
                        display: 'flex', alignItems: 'center', gap: 12,
                        cursor: 'pointer', transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8f8f6'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.settled ? '#639922' : '#EF9F27', flexShrink: 0 }}></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#2c2c2a' }}>{r.store_name}</div>
                        <div style={{ fontSize: 11, color: '#888780', marginTop: 1 }}>
                          {r.receipt_date} · Paid by {getMemberName(r.paid_by)}
                          {r.owed_by ? ` · Owed by ${getMemberName(r.owed_by)}` : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: '#2c2c2a', flexShrink: 0 }}>
                        ${Number(r.total_amount).toFixed(2)}
                      </div>
                      <div style={{ fontSize: 11, color: r.settled ? '#27500A' : '#D85A30', flexShrink: 0 }}>
                        {r.settled ? '✓' : '●'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Hidden camera input */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleImageCapture}
      />

      {/* Receipt detail modal */}
      {selectedReceipt && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedReceipt(null) }}
        >
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e8e4', padding: '1.5rem', width: '100%', maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#2c2c2a', margin: 0 }}>{selectedReceipt.store_name}</h3>
              <button onClick={() => setSelectedReceipt(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888780', padding: 0, lineHeight: 1 }}>✕</button>
            </div>

            {/* Amount */}
            <div style={{ background: '#f8f8f6', borderRadius: 10, padding: '14px 16px', marginBottom: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#2c2c2a' }}>${Number(selectedReceipt.total_amount).toFixed(2)}</div>
              <div style={{ fontSize: 12, color: '#888780', marginTop: 2 }}>CAD</div>
            </div>

            {/* Details */}
            {[
              ['Date', selectedReceipt.receipt_date],
              ['Paid by', getMemberName(selectedReceipt.paid_by)],
              ['Owed by', selectedReceipt.owed_by ? getMemberName(selectedReceipt.owed_by) : '—'],
              ['Status', selectedReceipt.settled ? '✓ Settled' : '● Unsettled'],
              ['Added', new Date(selectedReceipt.created_at).toLocaleDateString('en-CA')],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f0f0ee', fontSize: 13 }}>
                <span style={{ color: '#888780' }}>{label}</span>
                <span style={{ color: label === 'Status' ? (selectedReceipt.settled ? '#27500A' : '#D85A30') : '#2c2c2a', fontWeight: label === 'Status' ? 500 : 400 }}>{value}</span>
              </div>
            ))}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => toggleSettled(selectedReceipt.id, selectedReceipt.settled)}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: selectedReceipt.settled ? '#f0f0ee' : '#EAF3DE', color: selectedReceipt.settled ? '#888780' : '#27500A', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                {selectedReceipt.settled ? 'Mark unsettled' : 'Mark settled'}
              </button>
              <button
                onClick={() => deleteReceipt(selectedReceipt.id)}
                style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: '#FCEBEB', color: '#A32D2D', cursor: 'pointer', fontSize: 13 }}>
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Scan modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8e8e4', padding: '1.5rem', width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>

            <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 14, color: '#2c2c2a' }}>
              {scanStep === 'idle' ? 'Add receipt' : scanStep === 'scanning' ? 'Reading receipt...' : scanStep === 'reviewing' ? 'Review scanned receipt' : 'Add receipt'}
            </h3>

            {/* Scan preview */}
            {scanPreview && (
              <div style={{ marginBottom: 14, borderRadius: 10, overflow: 'hidden', border: '1px solid #e8e8e4', position: 'relative' }}>
                <img src={scanPreview} alt="Receipt" style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }} />
                {scanning && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(55,138,221,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#378ADD', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>🔍</span> Reading receipt...
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Suggestion banner */}
            {scanSuggestion && scanStep === 'reviewing' && (
              <div style={{ background: '#EAF3DE', border: '1px solid #97C459', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#27500A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✅</span>
                <span>Receipt scanned! Review and edit the details below before saving.</span>
              </div>
            )}

            {/* Scan button inside modal if no image yet */}
            {scanStep === 'idle' && (
              <button onClick={triggerCamera}
                style={{ width: '100%', padding: '14px', borderRadius: 10, border: '2px dashed #d0d0cc', background: '#f8f8f6', cursor: 'pointer', fontSize: 13, color: '#888780', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ fontSize: 24 }}>📷</span>
                <div>
                  <div style={{ fontWeight: 500, color: '#2c2c2a' }}>Scan receipt with camera</div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>AI will extract store, amount and date</div>
                </div>
              </button>
            )}

            {/* Form fields */}
            {[
              { label: 'Store / supplier', key: 'store_name', type: 'text', placeholder: 'e.g. Costco' },
              { label: 'Amount ($)', key: 'total_amount', type: 'number', placeholder: '0.00' },
              { label: 'Date', key: 'receipt_date', type: 'date' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 4 }}>
                  {f.label}
                  {scanSuggestion && scanSuggestion[f.key === 'store_name' ? 'store' : f.key === 'total_amount' ? 'amount' : 'date'] && (
                    <span style={{ fontSize: 10, marginLeft: 6, padding: '1px 5px', borderRadius: 4, background: '#EAF3DE', color: '#27500A' }}>AI suggested</span>
                  )}
                </label>
                <input type={f.type} value={form[f.key]} placeholder={f.placeholder}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 13, boxSizing: 'border-box', color: '#2c2c2a', background: scanSuggestion ? '#fffef0' : '#fff' }} />
              </div>
            ))}

            {/* Paid by / Owed by */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {[['Paid by', 'paid_by'], ['Owed by', 'owed_by']].map(([label, key]) => (
                <div key={key}>
                  <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 4 }}>{label}</label>
                  <select value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 13, color: '#2c2c2a', background: '#fff', boxSizing: 'border-box' }}>
                    <option value="">Select...</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.users?.display_name || m.users?.email}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Re-scan option */}
            {scanStep === 'reviewing' && (
              <button onClick={triggerCamera}
                style={{ width: '100%', padding: '7px', borderRadius: 8, border: '1px solid #d0d0cc', background: 'none', cursor: 'pointer', fontSize: 12, color: '#888780', marginBottom: 10 }}>
                📷 Re-scan with camera
              </button>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => setShowModal(false)}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #d0d0cc', background: 'none', cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={saveReceipt} disabled={saving || scanning}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: scanning ? '#b0b0ac' : '#378ADD', color: '#fff', cursor: saving || scanning ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}>
                {saving ? 'Saving...' : scanning ? 'Scanning...' : 'Save receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const primaryBtnStyle = { padding: '7px 14px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }
const outlineBtnStyle = { padding: '7px 14px', borderRadius: 8, border: '1px solid #d0d0cc', background: 'none', fontSize: 13, cursor: 'pointer', color: '#2c2c2a' }
