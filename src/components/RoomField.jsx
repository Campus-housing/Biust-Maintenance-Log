import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { areasFor, numberedRoomsFor } from '../utils/rooms';

// Room / area input with our own suggestion list in two labelled groups — "Common areas" first (kitchenette,
// ablution, common room…) then "Rooms". Anything typed is still accepted, and it can be left blank.
export default function RoomField({ block, value, onChange, label = 'Room / area' }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);
  const listId = useId();

  const areas = useMemo(() => [...new Set(areasFor(block))], [block]);
  const rooms = useMemo(() => [...new Set(numberedRoomsFor(block))], [block]);
  const q = String(value || '').trim().toLowerCase();

  const rank = (list) => {
    const pool = q ? list.filter((r) => r.toLowerCase().includes(q) && r.toLowerCase() !== q) : list;
    return [...pool.filter((r) => r.toLowerCase().startsWith(q)), ...pool.filter((r) => !r.toLowerCase().startsWith(q))];
  };
  const areaMatches = useMemo(() => rank(areas), [areas, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const roomMatches = useMemo(() => rank(rooms), [rooms, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownAreas = areaMatches.slice(0, q ? 6 : 9);
  const shownRooms = roomMatches.slice(0, 8);
  const items = [...shownAreas.map((v) => ({ v, group: 'area' })), ...shownRooms.map((v) => ({ v, group: 'room' }))];
  const moreRooms = roomMatches.length - shownRooms.length;

  useEffect(() => {
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  function pick(v) { onChange(v); setOpen(false); setActive(-1); }
  function onKeyDown(e) {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active].v); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  const rows = [];
  items.forEach((it, i) => {
    if (i === 0 || items[i - 1].group !== it.group) {
      rows.push(<li key={'h-' + it.group} role="presentation" className="combo-group">{it.group === 'area' ? 'Common areas' : 'Rooms'}</li>);
    }
    rows.push(
      <li
        key={it.group + it.v} role="option" aria-selected={i === active}
        className={'combo-opt' + (i === active ? ' combo-opt-active' : '')}
        onMouseDown={(e) => { e.preventDefault(); pick(it.v); }}
      >{it.v}</li>
    );
  });

  return (
    <div className="combo" ref={wrapRef}>
      <label className="field-label">{label}</label>
      <input
        className="input" placeholder="Room number, or pick a common area" value={value} autoComplete="off"
        role="combobox" aria-expanded={open && items.length > 0} aria-controls={listId} aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={onKeyDown}
      />
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="combo-list">
          {rows}
          {moreRooms > 0 && <li role="presentation" className="combo-more">{moreRooms} more room{moreRooms === 1 ? '' : 's'} — keep typing</li>}
        </ul>
      )}
    </div>
  );
}
