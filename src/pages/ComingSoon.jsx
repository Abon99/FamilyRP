export default function ComingSoon({ name }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888780' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🚧</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: '#2c2c2a', marginBottom: 6, textTransform: 'capitalize' }}>{name}</div>
      <div style={{ fontSize: 13 }}>This module is being built. Check back soon!</div>
    </div>
  )
}
