import { useEffect, useState } from 'react';
import { getDocs } from 'firebase/firestore';
import { usersCol } from '../firebase';
import { BLOCKS, BLOCK_GROUPS, CATEGORIES } from '../utils/constants';
import { isArchived, resolutionMs, formatDuration, average, blockLabel } from '../utils/helpers';
import { downloadWorkbook } from '../utils/export';
import PieChart from './PieChart';
import BarChart from './BarChart';
import ResolutionStats from './ResolutionStats';

const CATEGORY_COLORS = {
  electricity: '#F2A93C',
  plumbing: '#5B9BD5',
  furniture: '#C77B3B',
  access: '#8B96AD',
  transport: '#4FB477',
  wifi: '#A78BFA',
  inventory: '#F472B6',
};
const LOCATION_BAR_COLOR = '#5B9BD5';
const MAX_BAR_LOCATIONS = 8;
const ALL = '__all__';

export default function SummaryPanel({ tickets, semesterLabel, onClose }) {
  const [exportBlock, setExportBlock] = useState(ALL);
  const [viewBlock, setViewBlock] = useState(ALL);
  const [ras, setRas] = useState(null); // [{ name, blocks[] }] — null until loaded / if unavailable

  // Who is the RA for each block (staff can read the users list).
  useEffect(() => {
    let alive = true;
    getDocs(usersCol)
      .then((snap) => {
        if (!alive) return;
        setRas(snap.docs.map((d) => d.data()).filter((u) => u.role === 'reporter' && Array.isArray(u.assignedBlocks) && u.assignedBlocks.length));
      })
      .catch(() => { if (alive) setRas(null); });
    return () => { alive = false; };
  }, []);

  const byBlock = new Map();
  BLOCKS.forEach((b) => byBlock.set(b, { pending: 0, in_progress: 0, no_access: 0, done: 0, urgent: 0, total: 0 }));
  tickets.forEach((t) => {
    if (!byBlock.has(t.block)) byBlock.set(t.block, { pending: 0, in_progress: 0, no_access: 0, done: 0, urgent: 0, total: 0 });
    const row = byBlock.get(t.block);
    row[t.status] = (row[t.status] || 0) + 1;
    row.total++;
    if (t.urgent && t.status !== 'done') row.urgent++;
  });

  const scoped = viewBlock === ALL ? tickets : tickets.filter((t) => t.block === viewBlock);
  const openCount = scoped.filter((t) => t.status !== 'done').length;
  const closedCount = scoped.length - openCount;
  const avgResolution = average(scoped.map(resolutionMs).filter((m) => m !== null));

  // Charts show the current active load — archived (long-done) tickets are left out so old, settled
  // history doesn't skew "what's going on right now".
  const activeTickets = scoped.filter((t) => !isArchived(t));

  const categoryData = CATEGORIES.map((c) => ({
    label: c.label,
    value: activeTickets.filter((t) => t.category === c.id).length,
    color: CATEGORY_COLORS[c.id] || '#8B96AD',
  }));

  const locationCounts = new Map();
  activeTickets.forEach((t) => locationCounts.set(t.block, (locationCounts.get(t.block) || 0) + 1));
  const locationData = [...locationCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_BAR_LOCATIONS)
    .map(([label, value]) => ({ label: blockLabel(label), value, color: LOCATION_BAR_COLOR }));

  const blockRas = viewBlock === ALL || !ras ? [] : ras.filter((u) => u.assignedBlocks.includes(viewBlock));

  function handleExport() {
    const list = exportBlock === ALL ? tickets : tickets.filter((t) => t.block === exportBlock);
    downloadWorkbook(list, exportBlock === ALL ? 'all' : exportBlock);
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="display">Summary</h2>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>
        {semesterLabel && <p className="dim" style={{ fontSize: 11, marginTop: -8, marginBottom: 12 }}>{semesterLabel}</p>}

        <label className="field-label">View</label>
        <select className="input" style={{ margin: '6px 0 6px' }} value={viewBlock} onChange={(e) => setViewBlock(e.target.value)}>
          <option value={ALL}>All locations</option>
          {BLOCK_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((b) => <option key={b} value={b}>{blockLabel(b)}</option>)}
            </optgroup>
          ))}
        </select>
        {viewBlock !== ALL && ras && (
          <p style={{ fontSize: 12, margin: '0 0 10px', color: blockRas.length ? 'var(--muted)' : '#E15554' }}>
            {blockRas.length ? 'RA' + (blockRas.length > 1 ? 's' : '') + ': ' + blockRas.map((u) => u.name || u.email).join(', ') : 'No RA assigned to this location yet'}
          </p>
        )}

        <div className="stats-grid" style={{ marginTop: 10, marginBottom: 16 }}>
          <div className="stat-card"><div className="mono stat-num">{scoped.length}</div><div className="stat-label">Total</div></div>
          <div className="stat-card"><div className="mono stat-num" style={{ color: '#F2A93C' }}>{openCount}</div><div className="stat-label">Open</div></div>
          <div className="stat-card"><div className="mono stat-num" style={{ color: '#4FB477' }}>{closedCount}</div><div className="stat-label">Closed</div></div>
          <div className="stat-card"><div className="mono stat-num" style={{ fontSize: 14 }}>{formatDuration(avgResolution)}</div><div className="stat-label">Avg fix</div></div>
        </div>

        <label className="field-label">By category</label>
        <div style={{ marginTop: 6, marginBottom: 16 }}>
          <PieChart data={categoryData} />
        </div>

        {viewBlock === ALL && (
          <>
            <label className="field-label">By location (busiest {Math.min(MAX_BAR_LOCATIONS, locationData.length)})</label>
            <div style={{ marginTop: 8, marginBottom: 16 }}>
              <BarChart data={locationData} />
            </div>
          </>
        )}

        <label className="field-label">Resolution times</label>
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <ResolutionStats tickets={scoped} hideLocation={viewBlock !== ALL} openLimit={viewBlock === ALL ? 5 : 15} />
        </div>

        <div className="dash" style={{ margin: '4px 0 14px' }}></div>

        <label className="field-label">Every location, in full</label>
        <table className="summary-table" style={{ marginBottom: 16 }}>
          <thead>
            <tr><th>Location</th><th>Pend</th><th>Prog</th><th>No acc</th><th>Done</th><th>Total</th></tr>
          </thead>
          <tbody>
            {[...byBlock.entries()].map(([b, r]) => (
              <tr key={b}>
                <td>{blockLabel(b)}{r.urgent ? ' 🚩' : ''}</td>
                <td>{r.pending}</td><td>{r.in_progress}</td><td>{r.no_access}</td><td>{r.done}</td><td>{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="dash" style={{ margin: '4px 0 12px' }}></div>
        <label className="field-label">Export</label>
        <select className="input" style={{ margin: '6px 0' }} value={exportBlock} onChange={(e) => setExportBlock(e.target.value)}>
          <option value={ALL}>All locations</option>
          {BLOCK_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((b) => <option key={b} value={b}>{blockLabel(b)}</option>)}
            </optgroup>
          ))}
        </select>
        <button type="button" className="submit-btn" style={{ background: '#5B9BD5' }} onClick={handleExport}>Download Excel</button>
      </div>
    </div>
  );
}
