import { CATEGORIES } from '../utils/constants';
import { resolutionMs, formatDuration, average, median } from '../utils/helpers';
import BarChart from './BarChart';

const HOUR = 3600000;
const MAX_ROWS = 8;

function groupAverages(resolved, keyFn) {
  const groups = new Map();
  resolved.forEach((r) => {
    const k = keyFn(r.t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r.ms);
  });
  return [...groups.entries()].map(([label, list]) => ({ label, avg: average(list), count: list.length }));
}

export default function ResolutionStats({ tickets }) {
  const resolved = tickets
    .map((t) => ({ t, ms: resolutionMs(t) }))
    .filter((r) => r.ms !== null);
  const times = resolved.map((r) => r.ms);

  const overallAvg = average(times);
  const overallMedian = median(times);
  const within48 = times.length ? Math.round((times.filter((ms) => ms <= 48 * HOUR).length / times.length) * 100) : null;

  const byCategory = groupAverages(resolved, (t) => (CATEGORIES.find((c) => c.id === t.category) || { label: 'Other' }).label)
    .sort((a, b) => b.avg - a.avg)
    .map((g) => ({ label: g.label + ' (' + g.count + ')', value: g.avg, display: formatDuration(g.avg), color: '#F2A93C' }));

  const byLocation = groupAverages(resolved, (t) => t.block)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, MAX_ROWS)
    .map((g) => ({ label: g.label + ' (' + g.count + ')', value: g.avg, display: formatDuration(g.avg), color: '#5B9BD5' }));

  const now = Date.now();
  const oldestOpen = tickets
    .filter((t) => t.status !== 'done' && t.reportedAt)
    .map((t) => ({ t, age: now - new Date(t.reportedAt).getTime() }))
    .filter((r) => Number.isFinite(r.age) && r.age >= 0)
    .sort((a, b) => b.age - a.age)
    .slice(0, 5);

  return (
    <div>
      {resolved.length === 0 ? (
        <p className="dim" style={{ fontSize: 12, marginBottom: 12 }}>
          No resolved tickets in this view yet — resolution times appear once tickets are marked Done.
        </p>
      ) : (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 12 }}>
            <div className="stat-card">
              <div className="mono stat-num" style={{ fontSize: 14 }}>{formatDuration(overallAvg)}</div>
              <div className="stat-label">Average</div>
            </div>
            <div className="stat-card">
              <div className="mono stat-num" style={{ fontSize: 14 }}>{formatDuration(overallMedian)}</div>
              <div className="stat-label">Median</div>
            </div>
            <div className="stat-card">
              <div className="mono stat-num" style={{ fontSize: 14 }}>{within48}%</div>
              <div className="stat-label">Fixed in 48h</div>
            </div>
          </div>
          <p className="dim" style={{ fontSize: 10, margin: '0 0 12px' }}>Based on {resolved.length} resolved {resolved.length === 1 ? 'ticket' : 'tickets'}.</p>

          <label className="field-label">Average by category (slowest first)</label>
          <div style={{ marginTop: 8, marginBottom: 14 }}><BarChart data={byCategory} /></div>

          <label className="field-label">Average by location (slowest {Math.min(MAX_ROWS, byLocation.length)})</label>
          <div style={{ marginTop: 8, marginBottom: 14 }}><BarChart data={byLocation} /></div>
        </>
      )}

      <label className="field-label">Longest-waiting open tickets</label>
      <div style={{ marginTop: 6 }}>
        {oldestOpen.length === 0 ? (
          <p className="dim" style={{ fontSize: 12 }}>Nothing open — all caught up.</p>
        ) : (
          oldestOpen.map(({ t, age }) => (
            <div key={t.id} className="user-row" style={{ cursor: 'default', borderBottom: '1px solid var(--border)' }}>
              <span>
                <strong>{t.block} · Rm {t.room}</strong>
                <br /><span className="dim" style={{ fontSize: 11 }}>{t.description}</span>
              </span>
              <span className="mono" style={{ fontSize: 11, color: age > 7 * 24 * HOUR ? '#E15554' : 'var(--muted)' }}>{formatDuration(age)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
