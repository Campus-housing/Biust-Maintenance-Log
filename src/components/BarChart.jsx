export default function BarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return <p className="dim" style={{ fontSize: 12 }}>No data yet.</p>;
  }

  return (
    <div>
      {data.map((d) => (
        <div key={d.label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
            <span>{d.label}</span>
            <span className="mono dim">{d.display != null ? d.display : d.value}</span>
          </div>
          <div style={{ background: 'var(--border)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div style={{ width: (d.value / max) * 100 + '%', height: '100%', background: d.color || '#5B9BD5', borderRadius: 6 }}></div>
          </div>
        </div>
      ))}
    </div>
  );
}
