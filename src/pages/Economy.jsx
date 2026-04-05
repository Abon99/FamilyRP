import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Economy({ user, session }) {
  const [receipts, setReceipts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState([])
  const [form, setForm] = useState({ store_name: '', total_amount: '', receipt_date: new Date().toISOString().split('T')[0], paid_by: user.id, owed_by: '' })

  useEffect(() => { loadData() }, [session])

  async function loadData() {
    setLoading(true)
    const [{ data: r }, { data: m }] = await Promise.all([
      supabase.from('receipts').select('*').eq('session_id', session.id).order('created_at', { ascending: false }),
      supabase.from('session_members').select('user_id, role, users(id, display_name, email)').eq('session_id', session.id)
    ])
    setReceipts(r || [])
    setMembers(m || [])
    setLoading(false)
  }

  async function saveReceipt() {
    if (!form.store_name.trim() || !form.total_amount) { alert('Please fill in store name and amount'); return }
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
    else { setShowModal(false); setForm({ store_name: '', total_amount: '', receipt_date: new Date().toISOString().split('T')[0], paid_by: user.id, owed_by: '' }); await loadData() }
    setSaving(false)
  }

  async function toggleSettled(id, current) {
    await supabase.from('receipts').update({ settled: !current, settled_at: !current ? new Date().toISOString() : null }).eq('id', id)
    await loadData()
  }

  const getMemberName = (id) => members.find(m => m.user_id === id)?.users?.display_name || 'Unknown'
  const open = receipts.filter(r => !r.settled)
  const settled = receipts.filter(r => r.settled)
  const totalOpen = open.reduce((s, r) => s + Number(r.total_amount), 0)

  if (loading) return <div style={{ padding: '2rem', color: '#888780', textAlign: 'center' }}>Loading...</div>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
        {[['Open receipts', open.length], ['Outstanding', '£' + totalOpen.toFixed(2)], ['Settled', settled.length]].map(([l, v]) => (
          <div key={l} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e4', padding: 12 }}>
            <div style={{ fontSize: 11, color: '#888780', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#2c2c2a' }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Receipts</span>
        <button onClick={() => setShowModal(true)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>+ Add receipt</button>
      </div>

      {receipts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#888780', fontSize: 13 }}>No receipts yet. Add your first one!</div>
      ) : (
        receipts.map(r => (
          <div key={r.id} style={{ background: '#fff', border: '1px solid #e8e8e4', borderRadius: 12, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.settled ? '#639922' : '#EF9F27', flexShrink: 0 }}></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#2c2c2a' }}>{r.store_name}</div>
              <div style={{ fontSize: 11, color: '#888780', marginTop: 1 }}>
                {r.receipt_date} · Paid by {getMemberName(r.paid_by)}
                {r.owed_by ? ` · Owed by ${getMemberName(r.owed_by)}` : ''}
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#2c2c2a' }}>£{Number(r.total_amount).toFixed(2)}</div>
            <button onClick={() => toggleSettled(r.id, r.settled)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', background: r.settled ? '#f0f0ee' : '#EAF3DE', color: r.settled ? '#888780' : '#27500A', cursor: 'pointer' }}>
              {r.settled ? 'Settled' : 'Mark settled'}
            </button>
          </div>
        ))
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8e8e4', padding: '1.5rem', width: '100%', maxWidth: 420 }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16, color: '#2c2c2a' }}>Add receipt</h3>
            {[
              { label: 'Store / supplier', key: 'store_name', type: 'text', placeholder: 'e.g. Tesco' },
              { label: 'Amount (£)', key: 'total_amount', type: 'number', placeholder: '0.00' },
              { label: 'Date', key: 'receipt_date', type: 'date' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type} value={form[f.key]} placeholder={f.placeholder}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 13, boxSizing: 'border-box', color: '#2c2c2a' }} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['Paid by', 'paid_by'], ['Owed by', 'owed_by']].map(([label, key]) => (
                <div key={key}>
                  <label style={{ fontSize: 12, color: '#888780', display: 'block', marginBottom: 4 }}>{label}</label>
                  <select value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #d0d0cc', fontSize: 13, color: '#2c2c2a', background: '#fff' }}>
                    <option value="">Select...</option>
                    {members.map(m => <option key={m.user_id} value={m.user_id}>{m.users?.display_name || m.users?.email}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #d0d0cc', background: 'none', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button onClick={saveReceipt} disabled={saving} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#378ADD', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                {saving ? 'Saving...' : 'Save receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
