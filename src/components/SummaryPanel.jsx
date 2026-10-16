import { useState } from 'react';
import { BLOCKS, BLOCK_GROUPS, CATEGORIES } from '../utils/constants';
import { isArchived } from '../utils/helpers';
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

export default function SummaryPanel({ tickets, semesterLabel, onClose }) {
  const [exportBlock, setExportBlock] = useState('__all__');

  const byBlock = new Map();
  BLOCKS.forEach((b) => byBlock.set(b, { pending: 0, in_progress: 0, no_access: 0, done: 0, urgent: 0, total: 0 }));
  tickets.forEach((t) => {
    if (!byBlock.has(t.block)) byBlock.set(t.block, { pending: 0, in_progress: 0, no_access: 0, done: 0, urgent: 0, total: 0 });
    const row = byBlock.get(t.block);
    row[t.status] = (row[t.status] || 0) + 1;
    row.total++;
    if (t.urgent && t.status !== 'done') row.urgent++;
  });

  // Charts show the current active load — archived (long-done) tickets are left
  // out so old, settled history doesn't skew "what's going on right now".
  const activeTickets = tickets.filter((t) => !isArchived(t));

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
    .map(([label, value]) => ({ label, value, color: LOCATION_BAR_COLOR }));

  function handleExport() {
    const list = exportBlock === '__all__' ? tickets : tickets.filter((t) => t.block === exportBlock);
    downloadWorkbook(list, exportBlock === '__all__' ? 'all' : exportBlock);
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-header">
          <h2 className="display">Summary</h2>
          <button type="button" className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {semesterLabel && <p className="dim" style={{ fontSize: 11, marginTop: -8, marginBottom: 12 }}>{semesterLabel}</p>}
        <label className="field-label">By category</label>
        <div style={{ marginTop: 6, marginBottom: 16 }}>
          <PieChart data={categoryData} />
        </div>

        <label className="field-label">By location (busiest {Math.min(MAX_BAR_LOCATIONS, locationData.length)})</label>
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <BarChart data={locationData} />
        </div>

        <label className="field-label">Resolution times</label>
        <div style={{ marginTop: 8, marginBottom: 16 }}>
          <ResolutionStats tickets={tickets} />
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
                <td>{b}{r.urgent ? ' 🚩' : ''}</td>
                <td>{r.pending}</td><td>{r.in_progress}</td><td>{r.no_access}</td><td>{r.done}</td><td>{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="dash" style={{ margin: '4px 0 12px' }}></div>
        <label className="field-label">Export</label>
        <select className="input" style={{ margin: '6px 0' }} value={exportBlock} onChange={(e) => setExportBlock(e.target.value)}>
          <option value="__all__">All locations</option>
          {BLOCK_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((b) => <option key={b} value={b}>{b}</option>)}
            </optgroup>
          ))}
        </select>
        <button type="button" className="submit-btn" style={{ background: '#5B9BD5' }} onClick={handleExport}>Download Excel</button>
      </div>
    </div>
  );
}
