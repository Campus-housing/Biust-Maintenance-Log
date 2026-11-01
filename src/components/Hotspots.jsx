import { CATEGORIES } from '../utils/constants';
import { hotspotRooms, repeatFaults, blockLabel, roomLabel, formatDuration } from '../utils/helpers';

const catLabel = (id) => (CATEGORIES.find((c) => c.id === id) || { label: id }).label;

// Rooms that keep appearing, and faults that keep coming back — where planned repairs would pay off.
export default function Hotspots({ tickets }) {
  const rooms = hotspotRooms(tickets, 8);
  const repeats = repeatFaults(tickets, 60, 8);
  const ago = (t) => formatDuration(Date.now() - t) + ' ago';
  return (
    <div>
      <label className="field-label">Rooms with the most reports</label>
      <div style={{ margin: '6px 0 14px' }}>
        {rooms.length === 0 ? <p className="dim" style={{ fontSize: 12 }}>No room has been reported more than once.</p> : rooms.map((g) => (
          <div key={g.block + g.room} className="user-row" style={{ cursor: 'default', borderBottom: '1px solid var(--border)' }}>
            <span>
              <strong>{blockLabel(g.block)} · {roomLabel(g.room)}</strong>
              <br /><span className="dim" style={{ fontSize: 11 }}>{Object.entries(g.cats).map(([c, n]) => n + ' ' + catLabel(c).toLowerCase()).join(', ')}</span>
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{g.count} reports · {ago(g.last)}</span>
          </div>
        ))}
      </div>
      <label className="field-label">Faults that keep coming back (same room, same kind, within 60 days)</label>
      <div style={{ marginTop: 6 }}>
        {repeats.length === 0 ? <p className="dim" style={{ fontSize: 12 }}>No repeat faults found.</p> : repeats.map((g) => (
          <div key={g.block + g.room + g.category} className="user-row" style={{ cursor: 'default', borderBottom: '1px solid var(--border)' }}>
            <span>
              <strong>{blockLabel(g.block)} · {roomLabel(g.room)}</strong>
              <br /><span className="dim" style={{ fontSize: 11 }}>{catLabel(g.category)}</span>
            </span>
            <span className="mono" style={{ fontSize: 11, color: '#F2A93C' }}>{g.reports}× · last {ago(g.last)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
