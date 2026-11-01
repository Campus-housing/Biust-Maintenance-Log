import { resolutionMs, formatDuration, average } from '../utils/helpers';

// Who has what open, and who has been fixing things — from the assigned-to / resolved-by stamps on tickets.
export default function TeamStats({ tickets }) {
  const people = new Map();
  const row = (name) => { if (!people.has(name)) people.set(name, { name, open: 0, resolved: 0, times: [] }); return people.get(name); };
  let unassignedOpen = 0;
  tickets.forEach((t) => {
    if (t.status !== 'done') {
      if (t.assignedTo && t.assignedTo.name) row(t.assignedTo.name).open++; else unassignedOpen++;
    } else if (t.resolvedBy && t.resolvedBy.name) {
      const r = row(t.resolvedBy.name);
      r.resolved++;
      const ms = resolutionMs(t);
      if (ms !== null) r.times.push(ms);
    }
  });
  const rows = [...people.values()].sort((a, b) => b.open - a.open || b.resolved - a.resolved);

  return (
    <div>
      <p style={{ fontSize: 12, margin: '0 0 8px', color: unassignedOpen ? '#F2A93C' : 'var(--muted)' }}>
        {unassignedOpen} open {unassignedOpen === 1 ? 'ticket has' : 'tickets have'} nobody assigned.
      </p>
      {rows.length === 0 ? (
        <p className="dim" style={{ fontSize: 12 }}>Workload and fix counts appear here as tickets are assigned and resolved.</p>
      ) : (
        <table className="summary-table">
          <thead><tr><th>Person</th><th>Open now</th><th>Resolved</th><th>Avg fix</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}><td>{r.name}</td><td>{r.open}</td><td>{r.resolved}</td><td>{r.times.length ? formatDuration(average(r.times)) : '—'}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
