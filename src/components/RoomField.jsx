import { useId } from 'react';
import { roomsFor } from '../utils/rooms';

// Room input with autocomplete from that location's valid rooms/common areas. Anything typed is still accepted,
// and it can be left blank for general areas (the old tracker had these too).
export default function RoomField({ block, value, onChange, label = 'Room / area' }) {
  const listId = useId();
  const options = roomsFor(block);
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        className="input" placeholder="e.g. 17, 2B, Ablution-R47" value={value}
        list={options.length ? listId : undefined} onChange={(e) => onChange(e.target.value)}
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((r) => <option key={r} value={r} />)}
        </datalist>
      )}
    </div>
  );
}
