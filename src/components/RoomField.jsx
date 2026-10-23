import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { roomsFor } from '../utils/rooms';

// Room / area input with our own suggestion list (the browser's native <datalist> renders inconsistently and
// looked broken when the options changed). Suggestions come from the chosen location's room list; anything
// typed is still accepted, and it can be left blank for general areas.
export default function RoomField({ block, value, onChange, label = 'Room / area' }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef(null);
  const listId = useId();

  const all = useMemo(() => [...new Set(roomsFor(block))], [block]);
  const q = String(value || '').trim().toLowerCase();
  const matches = useMemo(() => {
    if (!all.length) return [];
    const pool = q ? all.filter((r) => r.toLowerCase().includes(q) && r.toLowerCase() !== q) : all;
    return [...pool.filter((r) => r.toLowerCase().startsWith(q)), ...pool.filter((r) => !r.toLowerCase().startsWith(q))];
  }, [all, q]);
  const shown = matches.slice(0, 8);

  useEffect(() => {
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  function pick(room) { onChange(room); setOpen(false); setActive(-1); }
  function onKeyDown(e) {
    if (!open || !shown.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % shown.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? shown.length - 1 : a - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(shown[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div className="combo" ref={wrapRef}>
      <label className="field-label">{label}</label>
      <input
        className="input" placeholder="e.g. 17, 2B, Ablution-R47" value={value} autoComplete="off"
        role="combobox" aria-expanded={open && shown.length > 0} aria-controls={listId} aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={onKeyDown}
      />
      {open && shown.length > 0 && (
        <ul id={listId} role="listbox" className="combo-list">
          {shown.map((r, i) => (
            <li
              key={r} role="option" aria-selected={i === active}
              className={'combo-opt' + (i === active ? ' combo-opt-active' : '')}
              onMouseDown={(e) => { e.preventDefault(); pick(r); }}
            >{r}</li>
          ))}
          {matches.length > shown.length && <li className="combo-more">{matches.length - shown.length} more — keep typing</li>}
        </ul>
      )}
    </div>
  );
}
