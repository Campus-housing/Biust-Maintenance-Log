import { CATEGORIES, SLA_HOURS, DEFAULT_SLA_HOURS } from '../utils/constants';
import { slaState, formatTarget } from '../utils/helpers';

// How often each kind of fault is fixed within its target, and what is overdue right now.
export default function SlaStats({ tickets }) {
  const rows = CATEGORIES.map((c) => {
    const list = tickets.filter((t) => t.category === c.id);
    const finished = list.filter((t) => ['met', 'breached'].includes(slaState(t)));
    return {
      label: c.label, target: SLA_HOURS[c.id] || DEFAULT_SLA_HOURS, finished: finished.length,
      met: finished.filter((t) => slaState(t) === 'met').length, overdue: list.filter((t) => slaState(t) === 'overdue').length,
    };
  }).filter((r) => r.finished || r.overdue);
  const finished = rows.reduce((n, r) => n + r.finished, 0);
  const met = rows.reduce((n, r) => n + r.met, 0);
  const overdue = rows.reduce((n, r) => n + r.overdue, 0);
  const pct = finished ? Math.round((met / finished) * 100) : null;

  if (!rows.length) return <p className="dim" style={{ fontSize: 12 }}>Nothing to measure yet.</p>;
  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 10 }}>
        <div className="stat-card"><div className="mono stat-num" style={{ color: pct !== null && pct >= 70 ? '#4FB477' : '#F2A93C' }}>{pct === null ? '—' : pct + '%'}</div><div className="stat-label">Fixed within target</div></div>
        <div className="stat-card"><div className="mono stat-num" style={{ color: overdue ? '#E15554' : '#4FB477' }}>{overdue}</div><div className="stat-label">Overdue now</div></div>
      </div>
      <table className="summary-table">
        <thead><tr><th>Category</th><th>Target</th><th>In time</th><th>Overdue</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}><td>{r.label}</td><td>{formatTarget(r.target)}</td><td>{r.finished ? r.met + '/' + r.finished : '—'}</td><td style={r.overdue ? { color: '#E15554' } : undefined}>{r.overdue}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
