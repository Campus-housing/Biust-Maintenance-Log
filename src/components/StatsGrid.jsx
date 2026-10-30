import { STATUSES } from '../utils/constants';
import { isArchived } from '../utils/helpers';

// Status tiles. When onSelect is given the tiles are buttons that filter the board (tap again to clear).
export default function StatsGrid({ tickets, activeStatus, onSelect }) {
  const counts = { pending: 0, in_progress: 0, no_access: 0, done: 0 };
  tickets.forEach((t) => { if (!isArchived(t)) counts[t.status] = (counts[t.status] || 0) + 1; });

  return (
    <div className="stats-grid">
      {STATUSES.map((s) => {
        const inner = (
          <>
            <div className="stat-card-top"><span className="stat-status-dot" style={{ background: s.color, boxShadow: '0 0 0 4px ' + s.color + '22' }}></span><span className="stat-label">{s.label}</span></div>
            <div className="mono stat-num" style={{ color: s.color }}>{counts[s.id] || 0}</div>
            <div className="stat-card-meta">{s.id === 'done' ? 'Closed this period' : (counts[s.id] || 0) === 0 ? 'Nothing waiting' : (counts[s.id] || 0) === 1 ? 'Needs attention' : 'Needs attention'}</div>
          </>
        );
        if (!onSelect) return <div key={s.id} className="stat-card">{inner}</div>;
        const active = activeStatus === s.id;
        return (
          <button
            key={s.id} type="button" className="stat-card stat-card-btn"
            style={active ? { borderColor: s.color, boxShadow: '0 0 0 1px ' + s.color + ' inset' } : undefined}
            onClick={() => onSelect(active ? 'all' : s.id)} aria-pressed={active}
          >{inner}</button>
        );
      })}
    </div>
  );
}
