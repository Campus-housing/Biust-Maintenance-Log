export default function PieChart({ data, size = 150 }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = size / 2;
  const cx = radius;
  const cy = radius;

  function polarToCartesian(angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  let cumulative = 0;
  const slices = total > 0
    ? data
        .filter((d) => d.value > 0)
        .map((d) => {
          const startAngle = (cumulative / total) * 360;
          cumulative += d.value;
          const endAngle = (cumulative / total) * 360;
          const sweep = endAngle - startAngle;
          if (sweep >= 359.99) {
            return { type: 'circle', color: d.color, key: d.label };
          }
          const start = polarToCartesian(startAngle);
          const end = polarToCartesian(endAngle);
          const largeArc = sweep > 180 ? 1 : 0;
          const path = `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
          return { type: 'path', d: path, color: d.color, key: d.label };
        })
    : [];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      {total === 0 ? (
        <p className="dim" style={{ fontSize: 12 }}>No data yet.</p>
      ) : (
        <>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
            {slices.map((s) =>
              s.type === 'circle' ? (
                <circle key={s.key} cx={cx} cy={cy} r={radius} fill={s.color} />
              ) : (
                <path key={s.key} d={s.d} fill={s.color} stroke="var(--card)" strokeWidth="1" />
              )
            )}
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {data.filter((d) => d.value > 0).map((d) => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, display: 'inline-block', flexShrink: 0 }}></span>
                <span className="dim">{d.label} · {d.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
