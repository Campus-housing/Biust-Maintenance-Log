import { CATEGORIES } from '../utils/constants';
import {
  resolutionMs, formatDuration, average, median, SPEED_BANDS, speedBand, monthKey, monthLabel,
  blockLabel, roomLabel, ageColor, formatAge,
} from '../utils/helpers';
import BarChart from './BarChart';
import TrendChart from './TrendChart';

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

export default function ResolutionStats({ tickets, hideLocation = false, openLimit = 5 }) {
  const resolved = tickets
    .map((t) => ({ t, ms: resolutionMs(t) }))
    .filter((r) => r.ms !== null);
  const times = resolved.map((r) => r.ms);

  const overallAvg = average(times);
  const overallMedian = median(times);
  const within48 = times.length ? Math.round((times.filter((ms) => ms <= 48 * HOUR).length / times.length) * 100) : null;

  // Speed bands (same cut-offs the old tracker used): how many were fixed fast vs slowly.
  const bandCounts = SPEED_BANDS.map((b) => ({ ...b, count: times.filter((ms) => speedBand(ms).id === b.id).length }));
  const bandData = bandCounts.map((b) => ({
    label: b.label + ' (' + b.hint + ')',
    value: b.count,
    display: b.count + (times.length ? ' · ' + Math.round((b.count / times.length) * 100) + '%' : ''),
    color: b.color,
  }));

  const byCategory = groupAverages(resolved, (t) => (CATEGORIES.find((c) => c.id === t.category) || { label: 'Other' }).label)
    .sort((a, b) => b.avg - a.avg)
    .map((g) => ({ label: g.label + ' (' + g.count + ')', value: g.avg, display: formatDuration(g.avg), color: '#F2A93C' }));

  const byLocation = groupAverages(resolved, (t) => t.block)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, MAX_ROWS)
    .map((g) => ({ label: blockLabel(g.label) + ' (' + g.count + ')', value: g.avg, display: formatDuration(g.avg), color: '#5B9BD5' }));

  // Monthly trends, by the month a ticket was reported.
  const volumeByMonth = new Map();
  tickets.forEach((t) => { const k = monthKey(t.reportedAt); if (k) volumeByMonth.set(k, (volumeByMonth.get(k) || 0) + 1); });
  const resolutionByMonth = new Map();
  resolved.forEach((r) => { const k = monthKey(r.t.reportedAt); if (!resolutionByMonth.has(k)) resolutionByMonth.set(k, []); resolutionByMonth.get(k).push(r.ms); });
  const volumeTrend = [...volumeByMonth.keys()].sort().map((k) => ({ label: monthLabel(k), value: volumeByMonth.get(k) }));
  const resolutionTrend = [...resolutionByMonth.keys()].sort().map((k) => {
    const avg = average(resolutionByMonth.get(k));
    return { label: monthLabel(k), value: avg / HOUR, display: formatAge(avg) };
  });

  const now = Date.now();
  const oldestOpen = tickets
    .filter((t) => t.status !== 'done' && t.reportedAt)
    .map((t) => ({ t, age: now - new Date(t.reportedAt).getTime() }))
    .filter((r) => Number.isFinite(r.age) && r.age >= 0)
    .sort((a, b) => b.age - a.age)
    .slice(0, openLimit);

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

          <label className="field-label">How fast problems get fixed</label>
          <div style={{ marginTop: 8, marginBottom: 14 }}><BarChart data={bandData} /></div>

          <label className="field-label">Average by category (slowest first)</label>
          <div style={{ marginTop: 8, marginBottom: 14 }}><BarChart data={byCategory} /></div>

          {!hideLocation && (
            <>
              <label className="field-label">Average by location (slowest {Math.min(MAX_ROWS, byLocation.length)})</label>
              <div style={{ marginTop: 8, marginBottom: 14 }}><BarChart data={byLocation} /></div>
            </>
          )}
        </>
      )}

      {volumeTrend.length > 0 && (
        <>
          <label className="field-label">Reports per month</label>
          <div style={{ marginTop: 6, marginBottom: 14 }}><TrendChart data={volumeTrend} color="#5B9BD5" /></div>
        </>
      )}
      {resolutionTrend.length > 0 && (
        <>
          <label className="field-label">Average time to fix, by month reported</label>
          <div style={{ marginTop: 6, marginBottom: 14 }}><TrendChart data={resolutionTrend} color="#F2A93C" /></div>
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
                <strong>{blockLabel(t.block)} · {roomLabel(t.room)}</strong>
                <br /><span className="dim" style={{ fontSize: 11 }}>{t.description}</span>
              </span>
              <span className="mono" style={{ fontSize: 11, color: ageColor(age) }}>{formatDuration(age)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
