import { COMMON_AREAS } from '../utils/constants';

export default function AreaChips({ value, onPick }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
      <span className="dim" style={{ fontSize: 10 }}>Not in a room?</span>
      {COMMON_AREAS.map((a) => (
        <button
          key={a} type="button" className="chip" style={{ padding: '3px 9px', fontSize: 11, ...(value === a ? { borderColor: '#F2A93C', color: '#F2A93C' } : null) }}
          onClick={() => onPick(value === a ? '' : a)}
        >{a}</button>
      ))}
    </div>
  );
}
