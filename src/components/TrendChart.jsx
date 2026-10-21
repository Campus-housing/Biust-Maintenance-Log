// Small SVG line chart for a short series (e.g. one point per month). data: [{ label, value, display? }]
export default function TrendChart({ data, color = '#5B9BD5', height = 112 }) {
  if (!data.length) return <p className="dim" style={{ fontSize: 12 }}>No data yet.</p>;
  const W = 320, padX = 18, padT = 22, padB = 22;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? (W - padX * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => ({
    x: data.length > 1 ? padX + i * stepX : W / 2,
    y: padT + (1 - d.value / max) * (height - padT - padB),
    d,
  }));
  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }} role="img">
      {pts.length > 1 && <polyline points={pts.map((p) => p.x + ',' + p.y).join(' ')} fill="none" stroke={color} strokeWidth="2" />}
      {pts.map((p) => (
        <g key={p.d.label}>
          <circle cx={p.x} cy={p.y} r="3.5" fill={color} />
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="var(--text)">{p.d.display != null ? p.d.display : p.d.value}</text>
          <text x={p.x} y={height - 6} textAnchor="middle" fontSize="9" fill="var(--dim)">{p.d.label}</text>
        </g>
      ))}
    </svg>
  );
}
