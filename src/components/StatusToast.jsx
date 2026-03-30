export default function StatusToast({ message, type }) {
  const bg = type === 'success' ? '#dcfce7' : type === 'error' ? '#fee2e2' : '#fef3c7'
  const color = type === 'success' ? '#15803d' : type === 'error' ? '#b91c1c' : '#92400e'

  return (
    <div style={{
      background: bg,
      color,
      padding: '10px 16px',
      borderRadius: 'var(--radius)',
      fontSize: 13,
      fontWeight: 600,
      boxShadow: '0 2px 8px rgba(0,0,0,.12)',
      maxWidth: 340,
    }}>
      {message}
    </div>
  )
}
